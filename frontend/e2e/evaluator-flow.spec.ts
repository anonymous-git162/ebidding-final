import { test, expect } from '@playwright/test';
import { loginOnce, restoreSession } from './test-utils';

const EVALUATOR_EMAIL = 'evaluator@ebidding.com';

test.describe('Evaluator Flow', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    await loginOnce(ctx, EVALUATOR_EMAIL);
    await ctx.close();
  });

  test.beforeEach(async ({ context }) => {
    await restoreSession(context, EVALUATOR_EMAIL);
  });

  test('evaluator can access evaluation page via direct navigation', async ({ page }) => {
    await page.goto('/evaluation');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Evaluation Queue').first()).toBeVisible();
  });

  test('evaluator can access results page via direct navigation', async ({ page }) => {
    await page.goto('/results');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Procurement Results').first()).toBeVisible();
  });

  test('shows evaluation data when procurement is selected', async ({ page }) => {
    await page.route('**/procurements*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'proc-1', requestNo: 'REQ-001', title: 'Eval Procurement', status: 'EVALUATION' }], meta: { total: 1 } }),
      });
    });
    await page.route('**/evaluation/reviews/proc-1', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/rfq-submissions/procurement/proc-1', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/evaluation/proc-1/criteria', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/evaluation/consolidation/proc-1', (route) => {
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({}) });
    });

    await page.goto('/evaluation');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Procurement').click();
    await page.getByRole('option', { name: /REQ-001/ }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('No vendor submissions')).toBeVisible();
  });
});
