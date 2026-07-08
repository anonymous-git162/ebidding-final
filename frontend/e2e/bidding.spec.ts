import { test, expect } from '@playwright/test';
import { loginOnce, restoreSession } from './test-utils';

const PROCUREMENT_EMAIL = 'procurement@ebidding.com';

test.describe('Bidding Room', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    await loginOnce(ctx, PROCUREMENT_EMAIL);
    await ctx.close();
  });

  test.beforeEach(async ({ context }) => {
    await restoreSession(context, PROCUREMENT_EMAIL);
  });

  test('procurement user can access bidding room via direct navigation', async ({ page }) => {
    await page.goto('/bidding');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('E-Bidding Room').first()).toBeVisible();
  });

  test('shows bidding rounds after selecting a procurement', async ({ page }) => {
    await page.route('**/procurements*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'proc-1', requestNo: 'REQ-001', title: 'Test Procurement', currency: 'USD' }], meta: { total: 1 } }),
      });
    });
    await page.route('**/ebidding/rounds/procurement/proc-1', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'round-1', roundNo: 1, status: 'OPEN', startsAt: new Date().toISOString(), responses: [] }]),
      });
    });

    await page.goto('/bidding');
    await page.waitForLoadState('networkidle');
    await page.locator('select').first().selectOption('proc-1');
    await page.waitForTimeout(500);
    await expect(page.getByText('Round 1')).toBeVisible();
  });
});
