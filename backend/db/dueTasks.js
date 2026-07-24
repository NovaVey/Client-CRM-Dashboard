// Shared query for incomplete tasks that are overdue or due within the next 3 days.
// due_date is returned as a plain "YYYY-MM-DD" string (via to_char) so callers never
// have to worry about timezone shifts when a DATE column round-trips through JS Date.
async function getDueSoonTasks(pool, { limit } = {}) {
  const limitClause = limit ? 'LIMIT $1' : '';
  const values = limit ? [limit] : [];

  const result = await pool.query(
    `SELECT
       tasks.id,
       tasks.contact_id,
       tasks.title,
       to_char(tasks.due_date, 'YYYY-MM-DD') AS due_date,
       tasks.completed,
       tasks.completed_at,
       tasks.created_at,
       contacts.name AS contact_name,
       contacts.email AS contact_email,
       (tasks.due_date < CURRENT_DATE) AS is_overdue
     FROM tasks
     JOIN contacts ON contacts.id = tasks.contact_id
     WHERE tasks.completed = false
       AND tasks.due_date <= CURRENT_DATE + INTERVAL '3 days'
     ORDER BY tasks.due_date ASC
     ${limitClause}`,
    values
  );

  return result.rows;
}

module.exports = { getDueSoonTasks };
