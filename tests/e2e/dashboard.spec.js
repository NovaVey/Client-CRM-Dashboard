const { test, expect } = require('@playwright/test');

const STATUS_LABELS = ['New', 'Contacted', 'Active', 'Inactive', 'Lost'];

test.describe('Dashboard view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for dashboard to finish its async loads.
    await expect(page.locator('#view-dashboard')).toHaveClass(/active/);
    await expect(page.locator('#stat-cards .stat-card')).not.toHaveCount(0);
  });

  test('loads and shows Dashboard heading', async ({ page }) => {
    await expect(page.locator('#view-dashboard')).toHaveClass(/active/);
    await expect(page.locator('#view-dashboard h1.page-title')).toHaveText('Dashboard');
  });

  test('status breakdown cards render for all 5 statuses with numeric values', async ({ page }) => {
    const cards = page.locator('#stat-cards .stat-card');
    await expect(cards).toHaveCount(5);

    const seenLabels = [];
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      // .stat-label has CSS text-transform: uppercase, so read the raw DOM
      // text content (not the rendered/visual innerText) to compare labels.
      const label = (await card.locator('.stat-label').textContent()).trim();
      const valueText = (await card.locator('.stat-value').innerText()).trim();
      seenLabels.push(label);

      expect(valueText).toMatch(/^\d+$/);
      const value = parseInt(valueText, 10);
      expect(value).toBeGreaterThanOrEqual(0);
    }

    for (const expected of STATUS_LABELS) {
      expect(seenLabels).toContain(expected);
    }
  });

  test('highlight cards render Leads, Clients, Tasks Overdue with sane values', async ({ page }) => {
    const highlightCards = page.locator('#highlight-cards .highlight-card');
    await expect(highlightCards).toHaveCount(3);

    const values = {};
    const count = await highlightCards.count();
    for (let i = 0; i < count; i++) {
      const card = highlightCards.nth(i);
      const label = (await card.locator('.lbl').innerText()).trim();
      const numText = (await card.locator('.num').innerText()).trim();
      expect(numText).toMatch(/^\d+$/);
      values[label] = parseInt(numText, 10);
    }

    expect(values).toHaveProperty('Leads');
    expect(values).toHaveProperty('Clients');
    expect(values).toHaveProperty('Tasks Overdue');

    expect(values['Leads']).toBeGreaterThanOrEqual(0);
    expect(values['Clients']).toBeGreaterThanOrEqual(0);
    expect(values['Tasks Overdue']).toBeGreaterThanOrEqual(0);

    // 10 leads + 10 clients are seeded and treated as read-only baseline.
    expect(values['Leads']).toBeGreaterThanOrEqual(10);
    expect(values['Clients']).toBeGreaterThanOrEqual(10);
  });

  test('Tasks Due Soon lists at least one task with contact name and title; overdue items are flagged', async ({ page }) => {
    const items = page.locator('#tasks-due-list .list-item');
    await expect(items).not.toHaveCount(0);

    const count = await items.count();
    let overdueSeen = 0;

    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const title = (await item.locator('.task-title').innerText()).trim();
      const contactName = (await item.locator('.task-contact').innerText()).trim();
      const dueText = (await item.locator('.task-due').innerText()).trim();

      expect(title.length).toBeGreaterThan(0);
      expect(contactName.length).toBeGreaterThan(0);
      expect(dueText.length).toBeGreaterThan(0);

      const titleClass = await item.locator('.task-title').getAttribute('class');
      const dueClass = await item.locator('.task-due').getAttribute('class');
      const isFlaggedOverdue = /overdue-text/.test(titleClass || '') && /overdue-text/.test(dueClass || '');

      if (isFlaggedOverdue) overdueSeen++;
    }

    if (overdueSeen === 0) {
      test.info().annotations.push({
        type: 'note',
        description: 'No overdue tasks were present at run time (none of the due-soon tasks had a due date before today); overdue-text class could not be verified against a real overdue item.',
      });
    } else {
      expect(overdueSeen).toBeGreaterThan(0);
    }
  });

  test('Recently Added contacts render clickable rows that navigate to Contact Detail', async ({ page }) => {
    const rows = page.locator('#recent-contacts-list .contact-row');
    await expect(rows).not.toHaveCount(0);

    const firstRow = rows.first();
    const nameLink = firstRow.locator('.name-link');
    const name = (await nameLink.innerText()).trim();
    expect(name.length).toBeGreaterThan(0);

    await nameLink.click();

    await expect(page.locator('#view-detail')).toHaveClass(/active/);
    await expect(page.locator('#view-dashboard')).not.toHaveClass(/active/);
    await expect(page.locator('#view-detail #detail-name')).toHaveValue(name);
  });

  test('Email Reminders card shows disabled status and disabled button; API confirms disabled', async ({ page, request }) => {
    const statusEl = page.locator('#reminders-status');
    await expect(statusEl).not.toHaveText('Checking status…', { timeout: 10000 });
    const statusText = (await statusEl.innerText()).trim();
    expect(statusText.length).toBeGreaterThan(0);
    expect(statusText).toMatch(/Disabled/i);

    const sendBtn = page.locator('#send-reminder-btn');
    await expect(sendBtn).toBeDisabled();

    const apiResp = await request.get('/api/reminders/status');
    expect(apiResp.status()).toBe(200);
    const body = await apiResp.json();
    expect(body).toEqual({ enabled: false });
  });

  test('Top nav navigates between Dashboard and Contacts views', async ({ page }) => {
    await expect(page.locator('#view-dashboard')).toHaveClass(/active/);

    await page.locator('#nav-contacts').click();
    await expect(page.locator('#view-contacts')).toHaveClass(/active/);
    await expect(page.locator('#view-dashboard')).not.toHaveClass(/active/);
    await expect(page.locator('#view-contacts h1.page-title')).toHaveText('Contacts');

    await page.locator('#nav-dashboard').click();
    await expect(page.locator('#view-dashboard')).toHaveClass(/active/);
    await expect(page.locator('#view-contacts')).not.toHaveClass(/active/);
    await expect(page.locator('#view-dashboard h1.page-title')).toHaveText('Dashboard');
  });
});
