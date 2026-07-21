require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const pool = require('./db/pool');

const app = express();

app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

// API routes
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/tasks', require('./routes/tasks'));

// GET /api/dashboard - aggregate data for the dashboard view
app.get('/api/dashboard', async (req, res) => {
  try {
    const statusCountsResult = await pool.query(
      `SELECT status, COUNT(*) as count
       FROM contacts
       GROUP BY status`
    );

    const tasksDueSoonResult = await pool.query(
      `SELECT tasks.*, contacts.name AS contact_name
       FROM tasks
       JOIN contacts ON contacts.id = tasks.contact_id
       WHERE tasks.completed = false
         AND tasks.due_date <= CURRENT_DATE + INTERVAL '3 days'
       ORDER BY tasks.due_date ASC
       LIMIT 10`
    );

    const recentContactsResult = await pool.query(
      `SELECT * FROM contacts
       ORDER BY created_at DESC
       LIMIT 5`
    );

    res.json({
      status_counts: statusCountsResult.rows,
      tasks_due_soon: tasksDueSoonResult.rows,
      recent_contacts: recentContactsResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

const PORT = process.env.PORT || 3004;

app.listen(PORT, () => {
  console.log(`Client CRM Dashboard server running on port ${PORT}`);
});
