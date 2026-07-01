---
description: Test complete procurement workflow lifecycle across all roles and statuses
---

# Workflow Lifecycle Test

Test the complete procurement workflow from DRAFT through COMPLETED, verifying each status transition endpoint works correctly across the required roles.

## Usage

```
/workflow-lifecycle-test [procurement-id]
```

## Arguments

- `$1` or `$ARGUMENTS`: Procurement ID to test. If omitted, creates a new procurement first.

## What It Does

Chains API calls through the full workflow lifecycle, logging in as the appropriate role at each step:

### RFP Workflow Path (Full Lifecycle)

```
DRAFT → SUBMITTED → UNDER_PROCUREMENT_REVIEW → APPROVED → RFP_PUBLISHED
→ VENDOR_RESPONSE_IN_PROGRESS → EBIDDING_PREP → EVALUATION
→ PENDING_APPROVAL → AWARD_APPROVED → AWARD_ANNOUNCED → COMPLETED
```

### Step-by-Step

| Step | Status | Endpoint | Role |
|------|--------|----------|------|
| 1 | DRAFT → SUBMITTED | `POST /procurements/:id/submit` | requester |
| 2 | SUBMITTED → UNDER_PROCUREMENT_REVIEW | `POST /procurements/:id/review/start` | procurement |
| 3 | UNDER_PROCUREMENT_REVIEW → APPROVED | `POST /procurements/:id/review/approve` | procurement |
| 4 | APPROVED → RFP_PUBLISHED | `POST /procurements/:id/publish` | procurement |
| 5 | RFP_PUBLISHED → VENDOR_RESPONSE_IN_PROGRESS | `POST /procurements/:id/vendor-response/complete` | procurement |
| 6 | VENDOR_RESPONSE_IN_PROGRESS → EBIDDING_PREP | `POST /procurements/:id/ebidding/start` | procurement |
| 7 | EBIDDING_PREP → EVALUATION | `POST /procurements/:id/ebidding/complete` | procurement |
| 8 | EVALUATION → PENDING_APPROVAL | `POST /procurements/:id/evaluation/complete` | procurement |
| 9 | PENDING_APPROVAL → AWARD_APPROVED | `POST /procurements/:id/approval/approve` | approver |
| 10 | AWARD_APPROVED → AWARD_ANNOUNCED | `POST /procurements/:id/award/announce` | procurement |
| 11 | AWARD_ANNOUNCED → COMPLETED | `POST /procurements/:id/award/complete` | procurement |

## PowerShell Template

```powershell
$procId = "<PROCUREMENT_ID>"
$baseUrl = "http://localhost:80/api"

function Login($role) {
  $login = (Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST `
    -ContentType "application/json" `
    -Body "{`"email`":`"$role@ebidding.com`",`"password`":`"password123`"}")
  return @{Authorization="Bearer $($login.accessToken)"}
}

function Transition($role, $endpoint, $body) {
  $headers = Login $role
  $params = @{
    Uri = "$baseUrl$endpoint"
    Method = "POST"
    Headers = $headers
    ContentType = "application/json"
  }
  if ($body) { $params.Body = $body }
  try {
    $result = Invoke-RestMethod @params
    Write-Host "✅ $role → $endpoint → $($result.status)"
    return $result
  } catch {
    Write-Host "❌ $role → $endpoint → $($_.Exception.Response.StatusCode)"
    return $null
  }
}

# Step 1: Submit
Transition "requester" "/procurements/$procId/submit"

# Step 2: Start Review
Transition "procurement" "/procurements/$procId/review/start"

# Step 3: Approve Review
Transition "procurement" "/procurements/$procId/review/approve"

# Step 4: Publish
Transition "procurement" "/procurements/$procId/publish" `
  '{`"submissionDeadline`":`"2026-07-15T00:00:00.000Z`"}'

# Step 5: Complete Vendor Response
Transition "procurement" "/procurements/$procId/vendor-response/complete"

# Step 6: Start E-Bidding
Transition "procurement" "/procurements/$procId/ebidding/start"

# Step 7: Complete E-Bidding
Transition "procurement" "/procurements/$procId/ebidding/complete"

# Step 8: Complete Evaluation
Transition "procurement" "/procurements/$procId/evaluation/complete"

# Step 9: Approve Award (different role!)
Transition "approver" "/procurements/$procId/approval/approve"

# Step 10: Announce Award
Transition "procurement" "/procurements/$procId/award/announce" `
  '{`"winningVendorId`":`"<VENDOR_ID>`",`"announcementText`":`"Congratulations!`"}'

# Step 11: Complete
Transition "procurement" "/procurements/$procId/award/complete"
```

## Examples

```bash
# Test full lifecycle on existing procurement
/workflow-lifecycle-test abc123-def456

# Create procurement first, then test lifecycle
/workflow-lifecycle-test
```

## Status Verification

After each transition, verify the returned status matches expected:

| Step | Expected Status After |
|------|----------------------|
| submit | SUBMITTED |
| review/start | UNDER_PROCUREMENT_REVIEW |
| review/approve | APPROVED |
| publish | RFP_PUBLISHED |
| vendor-response/complete | VENDOR_RESPONSE_IN_PROGRESS |
| ebidding/start | EBIDDING_PREP |
| ebidding/complete | EVALUATION |
| evaluation/complete | PENDING_APPROVAL |
| approval/approve | AWARD_APPROVED |
| award/announce | AWARD_ANNOUNCED |
| award/complete | COMPLETED |

## Common Failures

| Error | Cause | Fix |
|-------|-------|-----|
| 400 "Cannot transition" | Wrong current status | Check procurement status first with GET |
| 403 "Forbidden" | Wrong role for this step | Use the role listed in the endpoint mapping |
| 400 "Submission deadline required" | Publish without deadline | Include `submissionDeadline` in body |
| 400 "Winning vendor required" | Announce without vendor ID | Include `winningVendorId` in body |
| 400 "Minimum 2 vendors" | E-Bidding with <2 vendors | Invite and accept with 2+ vendors first |

## Notes

- Backend runs on port 3000, frontend nginx on port 80
- API base: `http://localhost:80/api` (via nginx proxy)
- PowerShell 5.1 compatible — no `||`, `?.`, `??` operators
- Status is strict — cannot skip steps in the workflow
- Approval goes through AWARD_APPROVED, not directly to COMPLETED
