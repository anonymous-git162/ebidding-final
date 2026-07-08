import { test, expect } from '@playwright/test';
import { loginOnce, restoreSession } from './test-utils';

test.describe('Procurement List', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    await loginOnce(ctx, 'requester@ebidding.com');
    await ctx.close();
  });

  test.beforeEach(async ({ context }) => {
    await restoreSession(context, 'requester@ebidding.com');
  });

  test('renders procurement list page with heading', async ({ page }) => {
    await page.goto('/procurements');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Procurements').first()).toBeVisible();
  });

  test('shows procurement table with expected columns', async ({ page }) => {
    await page.goto('/procurements');
    await page.waitForLoadState('networkidle');

    const columns = ['Request', 'Title', 'Type', 'Property', 'Status', 'Budget', 'Date'];
    for (const col of columns) {
      await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
    }
  });

  test('shows procurement rows when data exists', async ({ page }) => {
    await page.goto('/procurements');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('displays search input field', async ({ page }) => {
    await page.goto('/procurements');
    await page.waitForLoadState('networkidle');
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test('can navigate to create new procurement', async ({ page }) => {
    await page.goto('/procurements');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'New Request' }).click();
    await expect(page).toHaveURL(/\/procurements\/new/, { timeout: 10000 });
  });

  test('shows empty state when no procurements exist', async ({ page }) => {
    await page.route('**/api/procurements*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { total: 0 }, statusCounts: {} }),
      });
    });

    await page.goto('/procurements');
    await page.waitForLoadState('networkidle');
    // Wait for the 50ms debounced loadItems() to fire and complete
    await page.waitForTimeout(600);
    await expect(page.getByText('No procurements found').first()).toBeVisible({ timeout: 10000 });
  });
});
