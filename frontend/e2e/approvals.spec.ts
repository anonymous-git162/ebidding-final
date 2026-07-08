import { test, expect } from '@playwright/test';
import { loginOnce, restoreSession } from './test-utils';

test.describe('Approvals', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    await loginOnce(ctx, 'approver@ebidding.com');
    await ctx.close();
  });

  test.beforeEach(async ({ context }) => {
    await restoreSession(context, 'approver@ebidding.com');
  });

  test('shows approval inbox page for approver', async ({ page }) => {
    await page.goto('/approvals');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Approval Inbox').first()).toBeVisible();
  });

  test('shows pending approvals table with expected columns', async ({ page }) => {
    await page.goto('/approvals');

    const columns = ['Request No', 'Title', 'Type', 'Requester', 'Budget', 'Status', 'Created', 'Actions'];
    for (const col of columns) {
      await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
    }
  });

  test('shows no pending approvals message when inbox is empty', async ({ page }) => {
    await page.route('**/approval/inbox', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/approvals');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('No pending approvals').first()).toBeVisible({ timeout: 10000 });
  });

  test('displays approve button for approval items', async ({ page }) => {
    await page.goto('/approvals');
    await page.waitForLoadState('networkidle');
    const count = await page.getByRole('button', { name: 'Approve' }).count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('opens confirmation dialog when clicking reject', async ({ page }) => {
    await page.route('**/approval/inbox', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'test-1',
          requestNo: 'REQ-001',
          title: 'Test Procurement',
          requestType: 'RFP',
          requester: { fullName: 'John Doe' },
          budgetEstimate: 50000,
          status: 'PENDING_APPROVAL',
          createdAt: new Date().toISOString(),
        }]),
      });
    });

await page.goto('/approvals');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Approval Inbox').first()).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Reject' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Reject' })).toBeVisible();
    await expect(page.getByLabel('Reason')).toBeVisible();
  });

  test('allows approver to return a procurement with reason', async ({ page }) => {
    await page.route('**/approval/inbox', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'test-2',
          requestNo: 'REQ-002',
          title: 'Return Test Procurement',
          requestType: 'RFQ',
          requester: { fullName: 'Jane Doe' },
          budgetEstimate: 25000,
          status: 'PENDING_APPROVAL',
          createdAt: new Date().toISOString(),
        }]),
      });
    });

    await page.route('**/approval/test-2/return', (route) => {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/approvals');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Approval Inbox').first()).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Return' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Reason').fill('Needs more documentation');
    await page.getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByText('Return successful')).toBeVisible({ timeout: 10000 });
  });
});
