const { test, expect, request } = require('@playwright/test');

const PREFIX = '[E2E-Detail]';

// Creates a throwaway contact directly via the API and returns its id/name.
async function createFixtureContact(baseURL, overrides = {}) {
  const ctx = await request.newContext({ baseURL });
  const name = overrides.name || `${PREFIX} Fixture ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await ctx.post('/api/contacts', {
    data: {
      name,
      email: overrides.email || 'e2e-detail@example.com',
      phone: overrides.phone || '555-0177',
      type: overrides.type || 'lead',
      status: overrides.status || 'new',
      source: overrides.source || 'e2e-seed',
    },
  });
  expect(res.status()).toBe(201);
  const created = await res.json();
  await ctx.dispose();
  return created;
}

async function deleteContactById(baseURL, id) {
  const ctx = await request.newContext({ baseURL });
  await ctx.delete(`/api/contacts/${id}`);
  await ctx.dispose();
}

// Navigates to Contacts, searches for the fixture by name, and clicks its card
// to open the Contact Detail view.
async function openContactDetail(page, name) {
  await page.goto('/');
  await page.locator('#nav-contacts').click();
  await expect(page.locator('#view-contacts')).toHaveClass(/active/);

  await page.locator('#search-input').fill(name);
  await page.waitForTimeout(500);
  const grid = page.locator('#contact-grid');
  await expect(grid.locator('.contact-card')).toHaveCount(1, { timeout: 5000 });
  await grid.locator('.contact-card').first().click();

  await expect(page.locator('#view-detail')).toHaveClass(/active/);
  await expect(page.locator('#view-detail #detail-name')).toHaveValue(name, { timeout: 5000 });
}

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

test.describe('Contact Detail view', () => {
  let fixture;

  test.beforeEach(async ({ baseURL }) => {
    fixture = await createFixtureContact(baseURL, {
      name: `${PREFIX} Main ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'lead',
      status: 'new',
      source: 'e2e-original-source',
    });
  });

  test.afterEach(async ({ baseURL }) => {
    if (fixture && fixture.id) {
      await deleteContactById(baseURL, fixture.id);
    }
  });

  test('back button returns to the Contacts view', async ({ page }) => {
    await openContactDetail(page, fixture.name);

    await page.locator('#back-to-contacts').click();
    await expect(page.locator('#view-contacts')).toHaveClass(/active/);
    await expect(page.locator('#view-detail')).not.toHaveClass(/active/);
  });

  test('header shows editable fields, status dropdown, and correct type badge', async ({ page }) => {
    await openContactDetail(page, fixture.name);
    const detail = page.locator('#view-detail');

    await expect(detail.locator('#detail-name')).toHaveValue(fixture.name);
    await expect(detail.locator('#detail-email')).toHaveValue(fixture.email);
    await expect(detail.locator('#detail-phone')).toHaveValue(fixture.phone);
    await expect(detail.locator('#detail-source')).toHaveValue(fixture.source);
    await expect(detail.locator('#detail-status')).toHaveValue(fixture.status);

    // Type badge is a non-editable span, not an input, and reflects the fixture's type.
    const badge = detail.locator('.detail-badges .badge-type-lead, .detail-badges .badge-type-client');
    await expect(badge).toHaveCount(1);
    await expect(badge).toHaveText('Lead');
  });

  test('editing source + status and saving persists, and does not clear type', async ({ page, baseURL }) => {
    await openContactDetail(page, fixture.name);
    const detail = page.locator('#view-detail');

    await detail.locator('#detail-source').fill('e2e-updated-source');
    await detail.locator('#detail-status').selectOption('contacted');
    await detail.locator('#save-contact-btn').click();

    // No error should appear after saving.
    await expect(detail.locator('#detail-save-error')).toHaveText('');

    // The save handler reloads the detail view; wait for the field to reflect the new value.
    await expect(detail.locator('#detail-source')).toHaveValue('e2e-updated-source', { timeout: 5000 });
    await expect(detail.locator('#detail-status')).toHaveValue('contacted');
    // Type must not have been altered by the save.
    await expect(detail.locator('.detail-badges .badge-type-lead')).toHaveText('Lead');

    // Navigate away and back to confirm persistence beyond the immediate reload.
    await detail.locator('#back-to-contacts').click();
    await expect(page.locator('#view-contacts')).toHaveClass(/active/);
    await openContactDetail(page, fixture.name);
    await expect(detail.locator('#detail-source')).toHaveValue('e2e-updated-source');
    await expect(detail.locator('#detail-status')).toHaveValue('contacted');
    await expect(detail.locator('.detail-badges .badge-type-lead')).toHaveText('Lead');

    // Confirm directly via the API too (source of truth, independent of UI rendering).
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.get(`/api/contacts/${fixture.id}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.source).toBe('e2e-updated-source');
    expect(body.status).toBe('contacted');
    expect(body.type).toBe('lead');
    await ctx.dispose();
  });

  test('notes: add a note, see it appear, then delete it', async ({ page }) => {
    await openContactDetail(page, fixture.name);
    const detail = page.locator('#view-detail');
    const notesList = detail.locator('#notes-list');

    // Starts with no notes.
    await expect(notesList.locator('.note-item')).toHaveCount(0);
    await expect(notesList.locator('.empty-state')).toBeVisible();

    const noteText = `${PREFIX} note body ${Date.now()}`;
    await detail.locator('#note-text').fill(noteText);
    await detail.locator('#add-note-form').locator('button[type="submit"]').click();

    await expect(notesList.locator('.note-item')).toHaveCount(1, { timeout: 5000 });
    await expect(notesList.locator('.note-item').first()).toContainText(noteText);

    // Delete it via its Delete button (identified by data-note-id).
    const noteItem = notesList.locator('.note-item').first();
    const deleteBtn = noteItem.locator('[data-note-id]');
    await expect(deleteBtn).toHaveCount(1);
    await deleteBtn.click();

    await expect(notesList.locator('.note-item')).toHaveCount(0, { timeout: 5000 });
    await expect(notesList.locator('.empty-state')).toBeVisible();
  });

  test('tasks: add, complete, overdue styling, and delete', async ({ page }) => {
    await openContactDetail(page, fixture.name);
    const detail = page.locator('#view-detail');
    const tasksList = detail.locator('#tasks-list');

    // Starts with no tasks.
    await expect(tasksList.locator('.task-item')).toHaveCount(0);
    await expect(tasksList.locator('.empty-state')).toBeVisible();

    // --- Task 1: a plain task we will mark complete. ---
    const taskTitle = `${PREFIX} complete-me ${Date.now()}`;
    await detail.locator('#task-title').fill(taskTitle);
    await detail.locator('#add-task-form').locator('button[type="submit"]').click();

    await expect(tasksList.locator('.task-item')).toHaveCount(1, { timeout: 5000 });
    let taskItem = tasksList.locator('.task-item').filter({ hasText: taskTitle });
    await expect(taskItem).toHaveCount(1);

    const checkbox = taskItem.locator('input[type="checkbox"][data-task-id]');
    await expect(checkbox).not.toBeChecked();
    await expect(checkbox).toBeEnabled();
    await checkbox.check();

    // After completion: item gets "completed" class, checkbox is checked+disabled.
    await expect(taskItem).toHaveClass(/completed/, { timeout: 5000 });
    const completedCheckbox = tasksList.locator('.task-item.completed').locator('input[type="checkbox"][data-task-id]');
    await expect(completedCheckbox).toBeChecked();
    await expect(completedCheckbox).toBeDisabled();

    // --- Task 2: overdue task (due date = yesterday). ---
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const overdueTitle = `${PREFIX} overdue-me ${Date.now()}`;
    await detail.locator('#task-title').fill(overdueTitle);
    await detail.locator('#task-due').fill(ymd(yesterday));
    await detail.locator('#add-task-form').locator('button[type="submit"]').click();

    await expect(tasksList.locator('.task-item')).toHaveCount(2, { timeout: 5000 });
    const overdueItem = tasksList.locator('.task-item').filter({ hasText: overdueTitle });
    await expect(overdueItem).toHaveCount(1);
    await expect(overdueItem.locator('.task-title')).toHaveClass(/overdue-text/);
    await expect(overdueItem.locator('.task-due')).toHaveClass(/overdue-text/);

    // The completed task should NOT be styled overdue even though it has no due date set here
    // (sanity: completed tasks are excluded from overdue regardless of due date).
    const completedItem = tasksList.locator('.task-item.completed');
    await expect(completedItem.locator('.task-title')).not.toHaveClass(/overdue-text/);

    // Delete the overdue task via its delete button (data-task-delete-id).
    const overdueDeleteBtn = overdueItem.locator('[data-task-delete-id]');
    await expect(overdueDeleteBtn).toHaveCount(1);
    await overdueDeleteBtn.click();

    await expect(tasksList.locator('.task-item')).toHaveCount(1, { timeout: 5000 });
    await expect(tasksList.locator('.task-item').filter({ hasText: overdueTitle })).toHaveCount(0);

    // Clean up the remaining (completed) task via its delete button too.
    const remainingDeleteBtn = tasksList.locator('.task-item').filter({ hasText: taskTitle }).locator('[data-task-delete-id]');
    await remainingDeleteBtn.click();
    await expect(tasksList.locator('.task-item')).toHaveCount(0, { timeout: 5000 });
    await expect(tasksList.locator('.empty-state')).toBeVisible();
  });
});
