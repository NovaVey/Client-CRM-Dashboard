const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { getDueSoonTasks } = require('../db/dueTasks');
const { sendReminderDigest } = require('../services/resend');

function remindersEnabled() {
  return process.env.REMINDER_EMAILS_ENABLED === 'true';
}

// GET /api/reminders/status - whether email reminders are turned on
router.get('/status', (req, res) => {
  res.json({ enabled: remindersEnabled() });
});

// POST /api/reminders/send - send (or preview) the due/overdue task digest email
router.post('/send', async (req, res) => {
  try {
    if (!remindersEnabled()) {
      return res.json({
        sent: false,
        reason: 'Email reminders are disabled. Set REMINDER_EMAILS_ENABLED=true (plus RESEND_API_KEY and REMINDER_FROM_EMAIL) to turn them on.',
      });
    }

    const tasks = await getDueSoonTasks(pool);

    if (tasks.length === 0) {
      return res.json({ sent: false, reason: 'No due or overdue tasks.', task_count: 0 });
    }

    const result = await sendReminderDigest(tasks);
    res.json({ sent: true, task_count: tasks.length, resend_id: result.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send reminder digest', detail: err.message });
  }
});

module.exports = router;
