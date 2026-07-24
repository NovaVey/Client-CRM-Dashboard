require('dotenv').config();

const pool = require('../db/pool');
const { getDueSoonTasks } = require('../db/dueTasks');
const { sendReminderDigest } = require('../services/resend');

async function run() {
  try {
    if (process.env.REMINDER_EMAILS_ENABLED !== 'true') {
      console.log('Email reminders are disabled (REMINDER_EMAILS_ENABLED is not "true"). Skipping.');
      return;
    }

    const tasks = await getDueSoonTasks(pool);

    if (tasks.length === 0) {
      console.log('No due or overdue tasks — skipping reminder email.');
      return;
    }

    const result = await sendReminderDigest(tasks);
    console.log(`Reminder digest sent for ${tasks.length} task(s). Resend id: ${result.id}`);
  } catch (err) {
    console.error('Failed to send reminder digest:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
