const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// POST /api/notes - add a note
router.post('/', async (req, res) => {
  try {
    const { contact_id, note_text } = req.body;

    if (!contact_id || !note_text || !String(note_text).trim()) {
      return res.status(400).json({ error: 'contact_id and note_text are required' });
    }

    const result = await pool.query(
      `INSERT INTO notes (contact_id, note_text)
       VALUES ($1, $2)
       RETURNING *`,
      [contact_id, note_text]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// DELETE /api/notes/:id - delete a note
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM notes WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

module.exports = router;
