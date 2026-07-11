import { test, expect } from '@playwright/test';
import { loginOnce, restoreSession } from './test-utils';

const VENDOR_EMAIL = 'vendor@ebidding.com';

test.describe('Vendor Flow', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    await loginOnce(ctx, VENDOR_EMAIL);
    await ctx.close();
  });

  test.beforeEach(async ({ page, context }) => {
    await restoreSession(context, VENDOR_EMAIL);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('vendor can login and view invitations', async ({ page }) => {

    await page.getByText('My Invitations').first().click();
    await expect(page).toHaveURL(/invitations/);
    await expect(page.getByRole('heading', { name: 'My Invitations' })).toBeVisible();
  });

  test('vendor can navigate to submissions', async ({ page }) => {
    await page.getByText('Submissions').first().click();
    await expect(page).toHaveURL(/submissions/);
    await expect(page.getByRole('heading', { name: 'Submissions' })).toBeVisible();
  });

  test('vendor can view analytics', async ({ page }) => {
    await page.getByText('Analytics').first().click();
    await expect(page).toHaveURL(/analytics/);
    await expect(page.getByRole('heading', { name: 'Vendor Analytics' })).toBeVisible();
  });

  test('vendor can see submissions page with procurements', async ({ page }) => {
    await page.route('**/procurements*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'sub-1', requestNo: 'REQ-001', title: 'Vendor Procurement', status: 'OPEN' }], meta: { total: 1 } }),
      });
    });
    await page.route('**/api/vendor-invitations/my', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'inv-1', procurementId: 'sub-1', invitationStatus: 'ACCEPTED' }]),
      });
    });

    await page.getByText('Submissions').first().click();
    await expect(page).toHaveURL(/submissions/);
    await expect(page.getByText('Submissions').first()).toBeVisible();
    await expect(page.getByText('Vendor Procurement')).toBeVisible();
  });
});
