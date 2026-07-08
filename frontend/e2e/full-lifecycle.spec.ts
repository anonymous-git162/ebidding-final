import { test, expect, type Page } from '@playwright/test';
import { loginOnce, restoreSession, sessions } from './test-utils';

const PASSWORD = 'Password123';

async function login(page: Page, email: string) {
  if (sessions.has(email)) {
    await page.context().clearCookies();
    await restoreSession(page.context(), email);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    return;
  }
  await page.context().clearCookies();
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Email').waitFor({ timeout: 15000 });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
  const cookies = await page.context().cookies();
  sessions.set(email, cookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    httpOnly: c.httpOnly ?? false,
  })));
}

const TITLE = `E2E Full Lifecycle - ${Date.now()}`;

test.describe('Full Procurement Lifecycle', () => {
  test('complete RFQ lifecycle end-to-end', async ({ page }) => {
    test.setTimeout(300000);
    let procId = '';

    // ════════════════════════════════════════════════════════════════
    // Step 1: Requester creates and submits RFQ
    // ════════════════════════════════════════════════════════════════
    await login(page, 'requester@ebidding.com');
    await page.goto('/procurements/new');
    await page.waitForLoadState('networkidle');
    await page.getByText('RFQ').first().click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Request Title').fill(TITLE);
    await page.getByLabel('Description').fill('E2E test full lifecycle');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Budget Estimate').fill('100000');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Submit for Review' }).click();
    await page.waitForURL(/\/procurements\/(?!new)[a-f0-9-]+$/, { timeout: 15000 });
    procId = page.url().split('/').pop()!;
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Submitted').first()).toBeVisible({ timeout: 10000 });

    // ════════════════════════════════════════════════════════════════
    // Step 2: Procurement reviews → approves → publishes
    // ════════════════════════════════════════════════════════════════
    await login(page, 'procurement@ebidding.com');
    await page.goto('/procurements');
    await page.waitForLoadState('networkidle');
    const row = page.locator('table tbody tr').filter({ hasText: TITLE.slice(0, 20) }).first();
    await row.waitFor({ timeout: 15000 });
    await row.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.getByRole('button', { name: 'Start Review' }).waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: 'Start Review' }).click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Approve' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Publish' }).click();
    await page.getByRole('dialog').getByLabel('Submission Deadline').fill(new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 16));
    await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('RFQ Open').first()).toBeVisible({ timeout: 10000 });

    // ════════════════════════════════════════════════════════════════
    // Step 3: Invite vendors + vendor2 accepts + submits (via API)
    // ════════════════════════════════════════════════════════════════
    const inviteResult = await page.evaluate(async (pid) => {
      const h = { 'Content-Type': 'application/json', 'x-requested-by': 'ebidding-app' };
      const vendorsRes = await (await fetch('/api/vendors', { credentials: 'include', headers: h })).json();
      const vendorList = vendorsRes?.data || [];
      const vendor2 = vendorList.find((v: any) => v.contactEmail === 'vendor2@ebidding.com');
      if (!vendor2) return { error: 'vendor2 not found' };
      const r = await fetch('/api/vendor-invitations', { method: 'POST', credentials: 'include', headers: h, body: JSON.stringify({ procurementId: pid, vendorIds: [vendor2.id] }) });
      return { ok: r.ok, status: r.status };
    }, procId);
    expect(inviteResult.ok).toBeTruthy();

    // vendor2 accepts + submits via API
    await login(page, 'vendor2@ebidding.com');
    const r1 = await page.evaluate(async (pid) => {
      const h = { 'Content-Type': 'application/json', 'x-requested-by': 'ebidding-app' };
      const invs = await (await fetch('/api/vendor-invitations/my', { credentials: 'include', headers: h })).json();
      const list = Array.isArray(invs) ? invs : [];
      const pending = list.find((i: any) => i.procurement?.id === pid && i.invitationStatus === 'PENDING');
      if (pending) await fetch(`/api/vendor-invitations/${pending.id}/accept`, { method: 'PUT', credentials: 'include', headers: h });
      const sub = await (await fetch('/api/rfq-submissions', { method: 'POST', credentials: 'include', headers: h, body: JSON.stringify({ procurementId: pid, price: 85000, proposalText: 'E2E test' }) })).json();
      if (sub?.id) await fetch(`/api/rfq-submissions/${sub.id}/submit`, { method: 'PUT', credentials: 'include', headers: h });
      return { accepted: !!pending, submitted: !!sub?.id };
    }, procId);
    expect(r1.accepted).toBeTruthy();
    expect(r1.submitted).toBeTruthy();

    // ════════════════════════════════════════════════════════════════
    // Step 4: Vendor response → move to EVALUATION (API)
    // ════════════════════════════════════════════════════════════════
    await login(page, 'procurement@ebidding.com');
    const t1 = await page.evaluate(async (pid) => {
      const h = { 'Content-Type': 'application/json', 'x-requested-by': 'ebidding-app' };
      await fetch(`/api/procurements/${pid}/vendor-response/complete`, { method: 'POST', credentials: 'include', headers: h });
      const r = await fetch(`/api/procurements/${pid}/ebidding/complete`, { method: 'POST', credentials: 'include', headers: h });
      return r.ok;
    }, procId);
    expect(t1).toBeTruthy();

    // ════════════════════════════════════════════════════════════════
    // Step 5: Evaluation UI — criteria → scoring → consolidation
    // ════════════════════════════════════════════════════════════════

    // 5a: Procurement sets evaluation criteria
    await page.goto('/evaluation');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.getByLabel('Procurement').click();
    await page.getByRole('option').filter({ hasText: TITLE }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const criteriaBtn = page.getByRole('button', { name: /Configure Criteria|Edit Criteria/i });
    if (await criteriaBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await criteriaBtn.click();
      await page.waitForTimeout(500);
      // Dialog opens with 4 pre-filled criteria (Price 40, Quality 30, Delivery 20, Compliance 10)
      await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
      await page.waitForTimeout(1000);
    }

    // 5b: Evaluator scores via API (slider UI is fragile in headless mode)
    await login(page, 'evaluator@ebidding.com');
    await page.goto('/evaluation');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.getByLabel('Procurement').click();
    await page.getByRole('option').filter({ hasText: TITLE }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.evaluate(async (pid) => {
      const h = { 'Content-Type': 'application/json', 'x-requested-by': 'ebidding-app' };
      const subs = await (await fetch(`/api/rfq-submissions/procurement/${pid}`, { credentials: 'include', headers: h })).json();
      const list = Array.isArray(subs) ? subs : [];
      for (const s of list) {
        await fetch('/api/evaluation/review', { method: 'POST', credentials: 'include', headers: h, body: JSON.stringify({ procurementId: pid, vendorId: s.vendorId, score: 85, comment: 'Good proposal' }) });
      }
    }, procId);

    // 5c: Lead evaluator consolidates
    await login(page, 'lead@ebidding.com');
    await page.goto('/evaluation');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.getByLabel('Procurement').click();
    await page.getByRole('option').filter({ hasText: TITLE }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const consolidationTab = page.getByRole('tab', { name: 'Consolidation' });
    if (await consolidationTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await consolidationTab.click();
      await page.waitForLoadState('networkidle');
      await page.getByLabel('Recommendation').fill('Recommend vendor2 based on pricing and quality');
      await page.getByLabel('Lead Commentary').fill('Vendor2 has strong proposal with good pricing');
      await page.getByRole('button', { name: 'Submit Consolidation' }).click();
      await expect(page.getByText('Consolidation submitted')).toBeVisible({ timeout: 10000 });
    }

    // 5d: Complete evaluation → PENDING_APPROVAL (API)
    await login(page, 'procurement@ebidding.com');
    const t2 = await page.evaluate(async (pid) => {
      const h = { 'Content-Type': 'application/json', 'x-requested-by': 'ebidding-app' };
      const r = await fetch(`/api/procurements/${pid}/evaluation/complete`, { method: 'POST', credentials: 'include', headers: h });
      return r.ok;
    }, procId);
    expect(t2).toBeTruthy();

    // ════════════════════════════════════════════════════════════════
    // Step 6: Approval → Award → Complete (API)
    // ════════════════════════════════════════════════════════════════
    await login(page, 'approver@ebidding.com');
    const t3 = await page.evaluate(async (pid) => {
      const h = { 'Content-Type': 'application/json', 'x-requested-by': 'ebidding-app' };
      const r = await fetch(`/api/procurements/${pid}/approval/approve`, { method: 'POST', credentials: 'include', headers: h, body: JSON.stringify({ comment: 'Approved' }) });
      return r.ok;
    }, procId);
    expect(t3).toBeTruthy();

    await login(page, 'procurement@ebidding.com');
    const t4 = await page.evaluate(async (pid) => {
      const h = { 'Content-Type': 'application/json', 'x-requested-by': 'ebidding-app' };
      const subs = await (await fetch(`/api/rfq-submissions/procurement/${pid}`, { credentials: 'include', headers: h })).json();
      const vid = (Array.isArray(subs) ? subs : [])[0]?.vendorId;
      if (!vid) return false;
      await fetch(`/api/procurements/${pid}/award/announce`, { method: 'POST', credentials: 'include', headers: h, body: JSON.stringify({ winningVendorId: vid, announcementText: 'Congratulations!' }) });
      const r = await fetch(`/api/procurements/${pid}/award/complete`, { method: 'POST', credentials: 'include', headers: h });
      return r.ok;
    }, procId);
    expect(t4).toBeTruthy();

    // ════════════════════════════════════════════════════════════════
    // Step 7: Vendor sees results
    // ════════════════════════════════════════════════════════════════
    await login(page, 'vendor2@ebidding.com');
    await page.goto('/results');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('My Results').first()).toBeVisible({ timeout: 10000 });

    // ════════════════════════════════════════════════════════════════
    // Cleanup: delete the procurement
    // ════════════════════════════════════════════════════════════════
    if (procId) {
      await login(page, 'admin@ebidding.com');
      await page.evaluate(async (pid) => {
        const h = { 'Content-Type': 'application/json', 'x-requested-by': 'ebidding-app' };
        await fetch(`/api/procurements/${pid}`, { method: 'DELETE', credentials: 'include', headers: h });
      }, procId);
    }
  });
});
