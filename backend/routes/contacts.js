const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// GET /api/contacts - list all contacts with optional filters
router.get('/', async (req, res) => {
  try {
    const { status, type, search } = req.query;
    const conditions = [];
    const values = [];

    if (status) {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }

    if (type) {
      values.push(type);
      conditions.push(`type = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      const idx = values.length;
      conditions.push(
        `(name ILIKE $${idx} OR email ILIKE $${idx} OR phone ILIKE $${idx})`
      );
    }

    let query = 'SELECT * FROM contacts';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY name ASC';

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// GET /api/contacts/:id - single contact with notes and tasks
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const contactResult = await pool.query(
      'SELECT * FROM contacts WHERE id = $1',
      [id]
    );

    if (contactResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const notesResult = await pool.query(
      'SELECT * FROM notes WHERE contact_id = $1 ORDER BY created_at ASC',
      [id]
    );

    const tasksResult = await pool.query(
      'SELECT * FROM tasks WHERE contact_id = $1 ORDER BY completed ASC, due_date ASC',
      [id]
    );

    const contact = contactResult.rows[0];
    contact.notes = notesResult.rows;
    contact.tasks = tasksResult.rows;

    res.json(contact);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// POST /api/contacts - create a contact
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, type, status, source } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const result = await pool.query(
      `INSERT INTO contacts (name, email, phone, type, status, source)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, email || null, phone || null, type || 'lead', status || 'new', source || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// PUT /api/contacts/:id - update a contact
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, type, status, source } = req.body;

    const result = await pool.query(
      `UPDATE contacts
       SET name = $1, email = $2, phone = $3, type = $4, status = $5, source = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [name, email, phone, type, status, source, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// DELETE /api/contacts/:id - delete a contact (notes/tasks cascade)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM contacts WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

module.exports = router;
