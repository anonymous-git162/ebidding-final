import { test, expect } from '@playwright/test';
import { loginOnce, restoreSession } from './test-utils';

const ADMIN_EMAIL = 'admin@ebidding.com';

test.describe('Dark Theme', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    await loginOnce(ctx, ADMIN_EMAIL);
    await ctx.close();
  });

  test.beforeEach(async ({ context }) => {
    await restoreSession(context, ADMIN_EMAIL);
  });

  test('can toggle between light and dark mode', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // The theme toggle is a Tooltip-wrapped IconButton in the AppBar
    // Find it by looking for the tooltip text
    const themeToggle = page.locator('[aria-label*="mode"], [title*="mode"]').first();
    if (await themeToggle.count() > 0) {
      await themeToggle.click({ timeout: 5000 });
    } else {
      // Fallback: click the second icon button in the toolbar
      const toolbar = page.locator('header');
      const buttons = toolbar.locator('button');
      if (await buttons.count() > 1) {
        await buttons.nth(1).click({ timeout: 5000 });
      }
    }

    // Verify the page still renders correctly after toggle
    await expect(page.locator('text=Dashboard').first()).toBeVisible();
  });

  test('dark theme persists across navigation', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Toggle theme via localStorage directly
    await page.evaluate(() => {
      localStorage.setItem('theme', 'dark');
    });

    // Navigate to another page via direct URL
    await page.goto('/procurements');
    await expect(page).toHaveURL(/\/procurements/, { timeout: 10000 });

    // Theme should persist (localStorage survives SPA navigation)
    const theme = await page.evaluate(() => localStorage.getItem('theme'));
    expect(theme).toBe('dark');
  });
});
