require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const pool = require('./db/pool');
const { getDueSoonTasks } = require('./db/dueTasks');

const app = express();

app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

// API routes
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/reminders', require('./routes/reminders'));

// GET /api/dashboard - aggregate data for the dashboard view
app.get('/api/dashboard', async (req, res) => {
  try {
    const statusCountsResult = await pool.query(
      `SELECT status, COUNT(*) as count
       FROM contacts
       GROUP BY status`
    );

    const tasksDueSoon = await getDueSoonTasks(pool, { limit: 10 });

    const recentContactsResult = await pool.query(
      `SELECT * FROM contacts
       ORDER BY created_at DESC
       LIMIT 5`
    );

    res.json({
      status_counts: statusCountsResult.rows,
      tasks_due_soon: tasksDueSoon,
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
