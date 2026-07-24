const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_TO = 'novavey.ai@gmail.com';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildDigestHtml(overdue, upcoming) {
  const renderRows = (tasks, color) =>
    tasks
      .map(
        (t) =>
          `<tr><td style="padding:6px 12px;color:${color};font-weight:${color ? '600' : '400'};">${escapeHtml(
            t.due_date
          )}</td><td style="padding:6px 12px;">${escapeHtml(t.contact_name)}</td><td style="padding:6px 12px;">${escapeHtml(
            t.title
          )}</td></tr>`
      )
      .join('');

  return `
    <div style="font-family:sans-serif;color:#1e293b;">
      <h2 style="margin-bottom:4px;">Client CRM Dashboard — Task Reminders</h2>
      <p style="color:#64748b;margin-top:0;">${overdue.length} overdue, ${upcoming.length} due within 3 days.</p>
      ${
        overdue.length
          ? `<h3 style="color:#dc2626;">Overdue</h3><table style="border-collapse:collapse;width:100%;">${renderRows(
              overdue,
              '#dc2626'
            )}</table>`
          : ''
      }
      ${
        upcoming.length
          ? `<h3>Due Soon</h3><table style="border-collapse:collapse;width:100%;">${renderRows(upcoming, '')}</table>`
          : ''
      }
    </div>
  `;
}

function buildDigestText(overdue, upcoming) {
  const lines = [`Client CRM Dashboard — Task Reminders`, `${overdue.length} overdue, ${upcoming.length} due within 3 days.`, ''];

  if (overdue.length) {
    lines.push('OVERDUE:');
    overdue.forEach((t) => lines.push(`  [${t.due_date}] ${t.contact_name} — ${t.title}`));
    lines.push('');
  }

  if (upcoming.length) {
    lines.push('DUE SOON:');
    upcoming.forEach((t) => lines.push(`  [${t.due_date}] ${t.contact_name} — ${t.title}`));
  }

  return lines.join('\n');
}

// tasks: rows from getDueSoonTasks(), each with an `is_overdue` boolean
async function sendReminderDigest(tasks) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;
  const to = process.env.REMINDER_TO_EMAIL || DEFAULT_TO;

  if (!apiKey) throw new Error('RESEND_API_KEY is not set');
  if (!from) throw new Error('REMINDER_FROM_EMAIL is not set');

  const overdue = tasks.filter((t) => t.is_overdue);
  const upcoming = tasks.filter((t) => !t.is_overdue);

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: `Client CRM: ${overdue.length} overdue, ${upcoming.length} due soon`,
      html: buildDigestHtml(overdue, upcoming),
      text: buildDigestText(overdue, upcoming),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend API error (${res.status}): ${detail}`);
  }

  return res.json();
}

module.exports = { sendReminderDigest };
