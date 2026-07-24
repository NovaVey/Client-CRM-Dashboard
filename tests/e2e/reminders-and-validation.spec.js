const { test, expect } = require('@playwright/test');

const FIXTURE_PREFIX = '[E2E-remind-valid]';

test.describe('Reminders endpoints', () => {
  test('GET /api/reminders/status returns disabled', async ({ request }) => {
    const res = await request.get('/api/reminders/status');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ enabled: false });
  });

  test('POST /api/reminders/send returns 200 with sent:false and a disabled reason, no error', async ({ request }) => {
    const res = await request.post('/api/reminders/send');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(false);
    expect(typeof body.reason).toBe('string');
    expect(body.reason.toLowerCase()).toContain('disabled');
    // Must not have attempted a real send / errored out.
    expect(body).not.toHaveProperty('resend_id');
    expect(body).not.toHaveProperty('error');
  });
});

test.describe('Dashboard reminders card (UI)', () => {
  test('send button disabled and status text reflects disabled state', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#view-dashboard')).toHaveClass(/active/);
    await expect(page.locator('#stat-cards .stat-card')).not.toHaveCount(0);

    const statusEl = page.locator('#view-dashboard #reminders-status');
    const btn = page.locator('#view-dashboard #send-reminder-btn');

    await expect(statusEl).toContainText('Disabled', { timeout: 10000 });
    await expect(btn).toBeDisabled();
  });
});

test.describe('Validation / error-handling edge cases', () => {
  test('POST /api/contacts with no name returns 400 and creates no row', async ({ request }) => {
    const res = await request.post('/api/contacts', {
      data: { email: 'no-name@example.com', type: 'lead' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);

    // Confirm no blank-named contact was created.
    const listRes = await request.get('/api/contacts');
    expect(listRes.status()).toBe(200);
    const contacts = await listRes.json();
    const blank = contacts.filter((c) => !c.name || !String(c.name).trim());
    expect(blank.length).toBe(0);
  });

  test('POST /api/contacts with blank/whitespace name returns 400 and creates no row', async ({ request }) => {
    const res = await request.post('/api/contacts', {
      data: { name: '   ', type: 'lead' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');

    const listRes = await request.get('/api/contacts');
    const contacts = await listRes.json();
    const blank = contacts.filter((c) => !c.name || !String(c.name).trim());
    expect(blank.length).toBe(0);
  });

  test('POST /api/notes with missing contact_id returns 400', async ({ request }) => {
    const res = await request.post('/api/notes', {
      data: { note_text: `${FIXTURE_PREFIX} orphan note` },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('POST /api/notes with missing note_text returns 400', async ({ request }) => {
    // Use a real seeded contact id (fetched, not mutated) just to isolate the missing-field check.
    const contactsRes = await request.get('/api/contacts');
    const contacts = await contactsRes.json();
    expect(contacts.length).toBeGreaterThan(0);
    const contactId = contacts[0].id;

    const res = await request.post('/api/notes', {
      data: { contact_id: contactId },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('POST /api/tasks with missing contact_id returns 400', async ({ request }) => {
    const res = await request.post('/api/tasks', {
      data: { title: `${FIXTURE_PREFIX} orphan task` },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('POST /api/tasks with missing title returns 400', async ({ request }) => {
    const contactsRes = await request.get('/api/contacts');
    const contacts = await contactsRes.json();
    expect(contacts.length).toBeGreaterThan(0);
    const contactId = contacts[0].id;

    const res = await request.post('/api/tasks', {
      data: { contact_id: contactId },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('GET /api/contacts/999999999 returns 404', async ({ request }) => {
    const res = await request.get('/api/contacts/999999999');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('PUT /api/contacts/999999999 returns 404', async ({ request }) => {
    const res = await request.put('/api/contacts/999999999', {
      data: { name: `${FIXTURE_PREFIX} nonexistent update` },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('DELETE /api/contacts/999999999 returns 404', async ({ request }) => {
    const res = await request.delete('/api/contacts/999999999');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('DELETE /api/notes/999999999 returns 404', async ({ request }) => {
    const res = await request.delete('/api/notes/999999999');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('DELETE /api/tasks/999999999 returns 404', async ({ request }) => {
    const res = await request.delete('/api/tasks/999999999');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('PATCH /api/tasks/999999999/complete returns 404', async ({ request }) => {
    const res = await request.patch('/api/tasks/999999999/complete');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('GET /api/contacts?search=zzznonexistentzzz returns empty array', async ({ request }) => {
    const res = await request.get('/api/contacts?search=zzznonexistentzzz');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });
});
