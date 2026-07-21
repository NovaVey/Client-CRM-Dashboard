const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// POST /api/tasks - add a task
router.post('/', async (req, res) => {
  try {
    const { contact_id, title, due_date } = req.body;

    if (!contact_id || !title || !String(title).trim()) {
      return res.status(400).json({ error: 'contact_id and title are required' });
    }

    const result = await pool.query(
      `INSERT INTO tasks (contact_id, title, due_date)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [contact_id, title, due_date || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PATCH /api/tasks/:id/complete - mark a task complete
router.patch('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE tasks
       SET completed = true, completed_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// DELETE /api/tasks/:id - delete a task
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
