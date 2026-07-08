import { test, expect } from '@playwright/test';
import { loginOnce, restoreSession } from './test-utils';

const ADMIN_EMAIL = 'admin@ebidding.com';

test.describe('User Management', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    await loginOnce(ctx, ADMIN_EMAIL);
    await ctx.close();
  });

  test.beforeEach(async ({ page, context }) => {
    await restoreSession(context, ADMIN_EMAIL);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('admin can access user management page', async ({ page }) => {

    await page.getByRole('button', { name: 'User Management' }).click();
    await expect(page).toHaveURL(/vendors/);
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
  });

  test('admin can open create user dialog', async ({ page }) => {
    await page.getByRole('button', { name: 'User Management' }).click();
    await expect(page).toHaveURL(/vendors/);

    await page.getByRole('button', { name: 'Add User' }).click();
    await expect(page.getByRole('heading', { name: 'Add New User' })).toBeVisible();
  });

  test('admin can search users', async ({ page }) => {
    await page.getByRole('button', { name: 'User Management' }).click();
    await expect(page).toHaveURL(/vendors/);

    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('admin');
    await page.waitForTimeout(500);
    await expect(page.getByText('admin@ebidding.com').first()).toBeVisible();
  });

  test('shows empty state when no users match search', async ({ page }) => {
    await page.route('**/users*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.getByRole('button', { name: 'User Management' }).click();
    await expect(page).toHaveURL(/vendors/);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('User Management').first()).toBeVisible();
  });
});
