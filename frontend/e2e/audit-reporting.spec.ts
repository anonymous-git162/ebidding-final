import { test, expect } from '@playwright/test';
import { loginOnce, restoreSession } from './test-utils';

const ADMIN_EMAIL = 'admin@ebidding.com';

test.describe('Audit & Reporting', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    await loginOnce(ctx, ADMIN_EMAIL);
    await ctx.close();
  });

  test.beforeEach(async ({ context }) => {
    await restoreSession(context, ADMIN_EMAIL);
  });

  test('admin can access reports page via direct navigation', async ({ page }) => {
    await page.goto('/reporting');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Reports & Analytics').first()).toBeVisible();
    await expect(page.getByText('Total Procurements')).toBeVisible();
    await expect(page.getByText('Export CSV')).toBeVisible();
  });

  test('admin can access audit page via direct navigation', async ({ page }) => {
    await page.goto('/audit');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Audit Logs').first()).toBeVisible();
  });
});
