const { test, expect, request } = require('@playwright/test');

const PREFIX = '[E2E-Contacts]';

async function gotoContacts(page) {
  await page.goto('/');
  await page.locator('#nav-contacts').click();
  await expect(page.locator('#view-contacts')).toHaveClass(/active/);
}

// Helper to create a contact via the UI Add Contact flow.
async function createContactViaUI(page, overrides = {}) {
  const name = overrides.name || `${PREFIX} Throwaway ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await page.locator('#add-contact-btn').click();
  await expect(page.locator('#side-panel')).toHaveClass(/open/);
  await page.locator('#ac-name').fill(name);
  if (overrides.email) await page.locator('#ac-email').fill(overrides.email);
  if (overrides.phone) await page.locator('#ac-phone').fill(overrides.phone);
  if (overrides.type) await page.locator('#ac-type').selectOption(overrides.type);
  if (overrides.status) await page.locator('#ac-status').selectOption(overrides.status);
  if (overrides.source) await page.locator('#ac-source').fill(overrides.source);
  await page.locator('#add-contact-form').locator('button[type="submit"], #ac-submit-btn').first().click();
  await expect(page.locator('#side-panel')).not.toHaveClass(/open/);
  return name;
}

// Clean up a contact by name via API (searches, then deletes any matches).
async function deleteContactByNameViaAPI(baseURL, name) {
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.get(`/api/contacts?search=${encodeURIComponent(name)}`);
  if (res.ok()) {
    const contacts = await res.json();
    for (const c of contacts) {
      if (c.name === name) {
        await ctx.delete(`/api/contacts/${c.id}`);
      }
    }
  }
  await ctx.dispose();
}

test.describe('Contacts view', () => {
  test('contact grid renders seeded contacts with expected fields', async ({ page }) => {
    await gotoContacts(page);
    const grid = page.locator('#contact-grid');
    const cards = grid.locator('.contact-card');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Check the first few cards have the expected structure.
    const sampleSize = Math.min(count, 5);
    for (let i = 0; i < sampleSize; i++) {
      const card = cards.nth(i);
      await expect(card.locator('.contact-card-name')).not.toHaveText('');
      const typeBadge = card.locator('.badge-type-lead, .badge-type-client');
      await expect(typeBadge).toHaveCount(1);
      const statusBadge = card.locator('[class*="badge-status-"]');
      await expect(statusBadge).toHaveCount(1);
      // email/source meta rows are always rendered (with an em-dash fallback).
      await expect(card.locator('.contact-card-meta')).toHaveCount(2);
    }
  });

  test('search filters to matching contacts after debounce', async ({ page }) => {
    await gotoContacts(page);
    const grid = page.locator('#contact-grid');
    await expect(grid.locator('.contact-card').first()).toBeVisible();

    await page.locator('#search-input').fill('Maria Lopez');
    // Wait past the 300ms debounce, then wait for the grid to reflect the filtered result.
    await page.waitForTimeout(500);
    await expect(grid.locator('.contact-card')).toHaveCount(1, { timeout: 5000 });
    await expect(grid.locator('.contact-card-name')).toHaveText('Maria Lopez');

    // Search for something that should not match any contact.
    await page.locator('#search-input').fill(`${PREFIX} nonexistent zzzqqq`);
    await page.waitForTimeout(500);
    await expect(grid.locator('.contact-card')).toHaveCount(0, { timeout: 5000 });
    await expect(grid.locator('.empty-state')).toBeVisible();
  });

  test('type filter pills show only leads / only clients / all', async ({ page }) => {
    await gotoContacts(page);
    const grid = page.locator('#contact-grid');
    await expect(grid.locator('.contact-card').first()).toBeVisible();

    // Leads
    await page.locator('#type-pills .pill[data-type="lead"]').click();
    await expect(page.locator('#type-pills .pill[data-type="lead"]')).toHaveClass(/active/);
    await page.waitForTimeout(100);
    let cards = grid.locator('.contact-card');
    let count = await cards.count();
    expect(count).toBeGreaterThan(0);
    await expect(grid.locator('.badge-type-client')).toHaveCount(0);
    await expect(grid.locator('.badge-type-lead')).toHaveCount(count);

    // Clients
    await page.locator('#type-pills .pill[data-type="client"]').click();
    await expect(page.locator('#type-pills .pill[data-type="client"]')).toHaveClass(/active/);
    await page.waitForTimeout(100);
    cards = grid.locator('.contact-card');
    count = await cards.count();
    expect(count).toBeGreaterThan(0);
    await expect(grid.locator('.badge-type-lead')).toHaveCount(0);
    await expect(grid.locator('.badge-type-client')).toHaveCount(count);

    // All
    await page.locator('#type-pills .pill[data-type=""]').click();
    await expect(page.locator('#type-pills .pill[data-type=""]')).toHaveClass(/active/);
    await page.waitForTimeout(100);
    const leadCount = await grid.locator('.badge-type-lead').count();
    const clientCount = await grid.locator('.badge-type-client').count();
    expect(leadCount).toBeGreaterThan(0);
    expect(clientCount).toBeGreaterThan(0);
  });

  test('status dropdown filters grid to matching status', async ({ page }) => {
    await gotoContacts(page);
    const grid = page.locator('#contact-grid');
    await expect(grid.locator('.contact-card').first()).toBeVisible();

    await page.locator('#status-filter').selectOption('active');
    await page.waitForTimeout(150);

    const count = await grid.locator('.contact-card').count();
    expect(count).toBeGreaterThan(0);
    await expect(grid.locator('.badge-status-active')).toHaveCount(count);
    // No other status badges should be present.
    await expect(grid.locator('.badge-status-new')).toHaveCount(0);
    await expect(grid.locator('.badge-status-contacted')).toHaveCount(0);
    await expect(grid.locator('.badge-status-inactive')).toHaveCount(0);
    await expect(grid.locator('.badge-status-lost')).toHaveCount(0);
  });

  test('add contact via slide-in panel creates and shows the new contact', async ({ page, baseURL }) => {
    await gotoContacts(page);
    const uniqueName = `${PREFIX} Add Flow ${Date.now()}`;

    await expect(page.locator('#side-panel')).not.toHaveClass(/open/);
    const createdName = await createContactViaUI(page, {
      name: uniqueName,
      email: 'e2e-contacts-add@example.com',
      phone: '555-0100',
      type: 'client',
      status: 'active',
      source: 'e2e-test',
    });

    // Search to confirm it shows up in the grid.
    await page.locator('#search-input').fill(uniqueName);
    await page.waitForTimeout(500);
    const grid = page.locator('#contact-grid');
    await expect(grid.locator('.contact-card')).toHaveCount(1, { timeout: 5000 });
    const card = grid.locator('.contact-card').first();
    await expect(card.locator('.contact-card-name')).toHaveText(uniqueName);
    await expect(card.locator('.badge-type-client')).toBeVisible();
    await expect(card.locator('.badge-status-active')).toBeVisible();
    await expect(card).toContainText('e2e-contacts-add@example.com');
    await expect(card).toContainText('Source: e2e-test');

    // Cleanup via API.
    await deleteContactByNameViaAPI(baseURL, createdName);
  });

  test('clicking a contact card navigates to Contact Detail view', async ({ page, baseURL }) => {
    await gotoContacts(page);
    const uniqueName = `${PREFIX} Nav Target ${Date.now()}`;
    const createdName = await createContactViaUI(page, { name: uniqueName });

    await page.locator('#search-input').fill(uniqueName);
    await page.waitForTimeout(500);
    const grid = page.locator('#contact-grid');
    await expect(grid.locator('.contact-card')).toHaveCount(1, { timeout: 5000 });

    await grid.locator('.contact-card').first().click();

    await expect(page.locator('#view-detail')).toHaveClass(/active/);
    await expect(page.locator('#view-contacts')).not.toHaveClass(/active/);
    await expect(page.locator('#view-detail #detail-name')).toHaveValue(uniqueName, { timeout: 5000 });

    // Cleanup via API.
    await deleteContactByNameViaAPI(baseURL, createdName);
  });

  test('delete contact: cancel dialog leaves contact intact', async ({ page, baseURL }) => {
    await gotoContacts(page);
    const uniqueName = `${PREFIX} Delete Cancel ${Date.now()}`;
    const createdName = await createContactViaUI(page, { name: uniqueName });

    await page.locator('#search-input').fill(uniqueName);
    await page.waitForTimeout(500);
    const grid = page.locator('#contact-grid');
    await expect(grid.locator('.contact-card')).toHaveCount(1, { timeout: 5000 });
    const card = grid.locator('.contact-card').first();

    let dialogMessage = '';
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });
    await card.locator('.card-delete-btn').click();
    await page.waitForTimeout(300);

    expect(dialogMessage.toLowerCase()).toContain('cannot be undone');
    // Still on contacts view, card still present.
    await expect(page.locator('#view-contacts')).toHaveClass(/active/);
    await expect(grid.locator('.contact-card')).toHaveCount(1);
    await expect(grid.locator('.contact-card-name')).toHaveText(uniqueName);

    // Cleanup via API.
    await deleteContactByNameViaAPI(baseURL, createdName);
  });

  test('delete contact via UI: accept dialog removes contact from grid and does not navigate', async ({ page, baseURL }) => {
    await gotoContacts(page);
    const uniqueName = `${PREFIX} Delete Accept ${Date.now()}`;
    await createContactViaUI(page, { name: uniqueName });

    await page.locator('#search-input').fill(uniqueName);
    await page.waitForTimeout(500);
    const grid = page.locator('#contact-grid');
    await expect(grid.locator('.contact-card')).toHaveCount(1, { timeout: 5000 });
    const card = grid.locator('.contact-card').first();

    let dialogMessage = '';
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });
    await card.locator('.card-delete-btn').click();

    expect(dialogMessage.toLowerCase()).toContain('cannot be undone');

    // Delete button click must not bubble to the card's own nav handler.
    await expect(page.locator('#view-contacts')).toHaveClass(/active/);
    await expect(page.locator('#view-detail')).not.toHaveClass(/active/);

    // Grid should update (contact removed) after the DELETE + reload.
    await expect(grid.locator('.contact-card')).toHaveCount(0, { timeout: 5000 });
    await expect(grid.locator('.empty-state')).toBeVisible();

    // Re-search from scratch to independently confirm it's gone.
    await page.locator('#search-input').fill('');
    await page.waitForTimeout(400);
    await page.locator('#search-input').fill(uniqueName);
    await page.waitForTimeout(500);
    await expect(grid.locator('.contact-card')).toHaveCount(0, { timeout: 5000 });

    // Confirm via API directly too (belt-and-suspenders — no cleanup needed, already deleted).
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.get(`/api/contacts?search=${encodeURIComponent(uniqueName)}`);
    const contacts = await res.json();
    expect(contacts.find((c) => c.name === uniqueName)).toBeUndefined();
    await ctx.dispose();
  });

  test('API: DELETE /api/contacts/:id returns 204 and subsequent GET returns 404', async ({ baseURL }) => {
    const ctx = await request.newContext({ baseURL });
    const uniqueName = `${PREFIX} API Delete ${Date.now()}`;

    const createRes = await ctx.post('/api/contacts', {
      data: {
        name: uniqueName,
        email: 'e2e-api-delete@example.com',
        phone: '555-0199',
        type: 'lead',
        status: 'new',
        source: 'e2e-api-test',
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.id).toBeTruthy();
    expect(created.name).toBe(uniqueName);

    const deleteRes = await ctx.delete(`/api/contacts/${created.id}`);
    expect(deleteRes.status()).toBe(204);

    const getRes = await ctx.get(`/api/contacts/${created.id}`);
    expect(getRes.status()).toBe(404);
    const body = await getRes.json();
    expect(body).toHaveProperty('error');

    await ctx.dispose();
  });
});
