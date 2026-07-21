require('dotenv').config({ path: '../../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const contacts = [
  { name: 'Maria Lopez', email: 'maria@lopezrealty.com', phone: '715-555-0101', type: 'client', status: 'active', source: 'referral' },
  { name: 'James Kowalski', email: 'james@kflooring.com', phone: '715-555-0102', type: 'client', status: 'active', source: 'website' },
  { name: 'Sandra Tran', email: 'stran@hairbysandra.com', phone: '715-555-0103', type: 'client', status: 'active', source: 'instagram' },
  { name: 'Derek Osei', email: 'derek@oseielectric.com', phone: '715-555-0104', type: 'lead', status: 'contacted', source: 'cold outreach' },
  { name: 'Carla Vega', email: 'cvega@vegaplumbing.net', phone: '715-555-0105', type: 'lead', status: 'new', source: 'website' },
  { name: 'Tom Nguyen', email: 'tom@nguyenlandscaping.com', phone: '715-555-0106', type: 'client', status: 'inactive', source: 'referral' },
  { name: 'Priya Sharma', email: 'priya@sharmabookkeeping.com', phone: '715-555-0107', type: 'lead', status: 'new', source: 'linkedin' },
  { name: 'Marcus Bell', email: 'mbell@bellroofing.com', phone: '715-555-0108', type: 'lead', status: 'contacted', source: 'cold outreach' },
  { name: 'Anita Patel', email: 'anita@naturalnails.com', phone: '715-555-0109', type: 'client', status: 'active', source: 'instagram' },
  { name: 'Kevin Russo', email: 'kevin@russopest.com', phone: '715-555-0110', type: 'lead', status: 'new', source: 'website' },
  { name: 'Diane Foster', email: 'diane@fosterinsurance.com', phone: '715-555-0111', type: 'client', status: 'active', source: 'referral' },
  { name: 'Joel Andersen', email: 'joel@andersenhvac.com', phone: '715-555-0112', type: 'lead', status: 'lost', source: 'cold outreach' },
  { name: 'Rachel Kim', email: 'rkim@kimcleaning.com', phone: '715-555-0113', type: 'client', status: 'active', source: 'google' },
  { name: 'Frank Deluca', email: 'frank@delucapainting.com', phone: '715-555-0114', type: 'lead', status: 'contacted', source: 'website' },
  { name: 'Yolanda Cruz', email: 'yolanda@cruzflowers.com', phone: '715-555-0115', type: 'client', status: 'active', source: 'referral' },
  { name: 'Brian Hayes', email: 'bhayes@hayestowing.com', phone: '715-555-0116', type: 'lead', status: 'new', source: 'linkedin' },
  { name: 'Grace Liu', email: 'grace@liubakery.com', phone: '715-555-0117', type: 'client', status: 'inactive', source: 'instagram' },
  { name: 'Omar Jackson', email: 'omar@jacksondetail.com', phone: '715-555-0118', type: 'lead', status: 'contacted', source: 'cold outreach' },
  { name: 'Nina Vasquez', email: 'nina@vasqueztax.com', phone: '715-555-0119', type: 'client', status: 'active', source: 'referral' },
  { name: 'Tyler Brooks', email: 'tyler@brookscarpentry.com', phone: '715-555-0120', type: 'lead', status: 'new', source: 'website' },
];

function randomDueDate() {
  const daysFromNow = Math.floor(Math.random() * 7) + 1; // 1-7 days
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');

    for (const contact of contacts) {
      const insertResult = await client.query(
        `INSERT INTO contacts (name, email, phone, type, status, source)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [contact.name, contact.email, contact.phone, contact.type, contact.status, contact.source]
      );
      const contactId = insertResult.rows[0].id;

      await client.query(
        `INSERT INTO notes (contact_id, note_text) VALUES ($1, $2)`,
        [contactId, `Initial contact. Source: ${contact.source}.`]
      );

      if (contact.type === 'lead' && contact.status !== 'lost') {
        await client.query(
          `INSERT INTO tasks (contact_id, title, due_date) VALUES ($1, $2, $3)`,
          [contactId, `Follow up with ${contact.name}`, randomDueDate()]
        );
      }

      console.log(`Seeded: ${contact.name}`);
    }

    console.log(`Done. Seeded ${contacts.length} contacts.`);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
