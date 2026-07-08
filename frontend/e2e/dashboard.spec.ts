import { test, expect } from '@playwright/test';
import { loginOnce, restoreSession } from './test-utils';

test.describe('Dashboard', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    await loginOnce(ctx, 'requester@ebidding.com');
    await loginOnce(ctx, 'approver@ebidding.com');
    await ctx.close();
  });

  test.beforeEach(async ({ page, context }) => {
    await restoreSession(context, 'requester@ebidding.com');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('renders KPI cards with key metrics', async ({ page }) => {
    const kpiLabels = ['Total', 'Drafts', 'Pending', 'Active', 'Completed', 'Rejected'];
    for (const label of kpiLabels) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
  });

  test('shows recent procurements section', async ({ page }) => {
    await expect(page.getByText('Recent Procurements').first()).toBeVisible();
  });

  test('shows recent activity section', async ({ page }) => {
    await expect(page.getByText('Recent Activity').first()).toBeVisible();
  });

  test('shows quick actions sidebar', async ({ page }) => {
    await expect(page.getByText('Quick Actions').first()).toBeVisible();
    await expect(page.getByText('New Request').first()).toBeVisible();
    await expect(page.getByText('My Requests').first()).toBeVisible();
  });

  test('can navigate to procurements via sidebar link', async ({ page }) => {
    await page.getByText('My Requests').first().click();
    await expect(page).toHaveURL(/\/procurements/, { timeout: 10000 });
  });

  test('shows approval inbox when logged in as approver', async ({ page, context }) => {
    await restoreSession(context, 'approver@ebidding.com');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Quick Actions').first()).toBeVisible();
    await expect(page.getByText('Approval Inbox').first()).toBeVisible();
  });
});
