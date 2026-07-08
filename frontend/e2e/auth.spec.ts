import { test, expect } from '@playwright/test';
import { loginOnce, restoreSession } from './test-utils';

test.describe('Auth flow', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    await loginOnce(ctx, 'admin@ebidding.com');
    await ctx.close();
  });

  test.beforeEach(async ({ context }) => {
    await restoreSession(context, 'admin@ebidding.com');
  });

  test('logs in and views dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Dashboard').first()).toBeVisible();
  });
});
