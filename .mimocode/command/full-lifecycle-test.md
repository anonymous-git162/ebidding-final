---
description: End-to-end procurement lifecycle test with vendor invitations, bidding, and award
---

# Full Lifecycle Test

Complete E2E procurement lifecycle from DRAFT to COMPLETED, including vendor invitations, acceptance, and award announcement.

## Usage

```
/full-lifecycle-test [procurement-id]
```

## What It Does

Tests the entire procurement flow in one script:
1. Submit procurement (requester)
2. Review + approve (procurement)
3. Publish with deadline (procurement)
4. Invite vendors (procurement)
5. Vendors accept invitations (vendor)
6. Complete vendor response (procurement)
7. Start + complete e-bidding (procurement)
8. Complete evaluation (procurement)
9. Approve award (approver)
10. Announce winner (procurement)
11. Mark completed (procurement)

## PowerShell Script

```powershell
param([string]$ProcId)

$baseUrl = "http://localhost:80/api"

function Login($role) {
  $l = (Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST `
    -ContentType "application/json" `
    -Body "{`"email`":`"$role@ebidding.com`",`"password`":`"password123`"}")
  return @{Authorization="Bearer $($l.accessToken)"}
}

function Step($num, $desc, $role, $endpoint, $body) {
  Write-Host "`n=== Step $num`: $desc ===" -ForegroundColor Cyan
  $h = Login $role
  $params = @{
    Uri         = "$baseUrl$endpoint"
    Method      = "POST"
    Headers     = $h
    ContentType = "application/json"
  }
  if ($body) { $params.Body = $body }
  try {
    $r = Invoke-RestMethod @params
    Write-Host "  PASS: status=$($r.status)" -ForegroundColor Green
    return $r
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "  FAIL: $code" -ForegroundColor Red
    return $null
  }
}

# --- Find or use provided procurement ---
if (-not $ProcId) {
  Write-Host "Finding a DRAFT procurement..." -ForegroundColor Yellow
  $req = Login "requester"
  $drafts = (Invoke-RestMethod -Uri "$baseUrl/procurements?status=DRAFT&limit=1" -Method GET -Headers $req).data
  if (-not $drafts -or $drafts.Count -eq 0) {
    Write-Host "No DRAFT procurements found. Create one first." -ForegroundColor Red
    exit 1
  }
  $ProcId = $drafts[0].id
  Write-Host "Using: $ProcId ($($drafts[0].title))" -ForegroundColor Yellow
}

Write-Host "`n============================================" -ForegroundColor Magenta
Write-Host " FULL LIFECYCLE TEST: $ProcId" -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta

# --- Steps 1-4: Get to PUBLISHED ---
Step 1 "DRAFT -> SUBMITTED" "requester" "/procurements/$ProcId/submit"
Step 2 "SUBMITTED -> UNDER_PROCUREMENT_REVIEW" "procurement" "/procurements/$ProcId/review/start"
Step 3 "UNDER_PROCUREMENT_REVIEW -> APPROVED" "procurement" "/procurements/$ProcId/review/approve"
Step 4 "APPROVED -> RFP_PUBLISHED" "procurement" "/procurements/$ProcId/publish" '{`"submissionDeadline`":`"2026-07-15T00:00:00.000Z`}'

# --- Step 5: Invite vendors ---
Write-Host "`n=== Step 5: INVITE VENDORS ===" -ForegroundColor Cyan
$h = Login "procurement"
$vendors = (Invoke-RestMethod -Uri "$baseUrl/vendors?limit=2" -Method GET -Headers $h).data
$vendorIds = @($vendors[0].id, $vendors[1].id)
$inviteBody = "{`"procurementId`":`"$ProcId`",`"vendorIds`":[$($vendorIds | ForEach-Object { "`"$_`"" } | Join-String -Separator ',')]}"
try {
  $invites = Invoke-RestMethod -Uri "$baseUrl/vendor-invitations" -Method POST -Headers $h -ContentType "application/json" -Body $inviteBody
  Write-Host "  PASS: Invited $($vendorIds.Count) vendors" -ForegroundColor Green
} catch {
  Write-Host "  FAIL: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
}

# --- Step 6: Vendors accept invitations ---
Write-Host "`n=== Step 6: VENDORS ACCEPT ===" -ForegroundColor Cyan
$h2 = Login "procurement"
$inviteList = (Invoke-RestMethod -Uri "$baseUrl/vendor-invitations?procurementId=$ProcId" -Method GET -Headers $h2).data
foreach ($inv in $inviteList) {
  $vId = $inv.vendorId
  $invId = $inv.id
  # Login as vendor
  $vUser = (Invoke-RestMethod -Uri "$baseUrl/vendors?limit=100" -Method GET -Headers $h2).data | Where-Object { $_.id -eq $vId }
  $vEmail = ($vUser.companyName -split ' ')[0].ToLower() + '@ebidding.com'
  try {
    $vh = Login "vendor"
    Invoke-RestMethod -Uri "$baseUrl/vendor-invitations/$invId/accept" -Method PUT -Headers $vh | Out-Null
    Write-Host "  PASS: Vendor $vId accepted" -ForegroundColor Green
  } catch {
    Write-Host "  FAIL: Vendor accept failed - $($_.Exception.Response.StatusCode)" -ForegroundColor Red
  }
}

# --- Steps 7-11: Complete workflow ---
Step 7 "VENDOR_RESPONSE_IN_PROGRESS -> EBIDDING_PREP" "procurement" "/procurements/$ProcId/vendor-response/complete"
Step 8 "EBIDDING_PREP -> EVALUATION" "procurement" "/procurements/$ProcId/ebidding/complete"
Step 9 "EVALUATION -> PENDING_APPROVAL" "procurement" "/procurements/$ProcId/evaluation/complete"
Step 10 "PENDING_APPROVAL -> AWARD_APPROVED" "approver" "/procurements/$ProcId/approval/approve"

# --- Step 11: Announce with winning vendor ---
Write-Host "`n=== Step 11: ANNOUNCE WINNER ===" -ForegroundColor Cyan
$h3 = Login "procurement"
$invites2 = (Invoke-RestMethod -Uri "$baseUrl/vendor-invitations?procurementId=$ProcId" -Method GET -Headers $h3).data
$winnerId = ($invites2 | Where-Object { $_.status -eq "ACCEPTED" } | Select-Object -First 1).vendorId
if ($winnerId) {
  $announceBody = "{`"winningVendorId`":`"$winnerId`",`"announcementText`":`"Congratulations! You have been selected.`"}"
  Step 11 "AWARD_APPROVED -> AWARD_ANNOUNCED" "procurement" "/procurements/$ProcId/award/announce" $announceBody
} else {
  Write-Host "  SKIP: No accepted vendors found" -ForegroundColor Yellow
}

# --- Step 12: Complete ---
Step 12 "AWARD_ANNOUNCED -> COMPLETED" "procurement" "/procurements/$ProcId/award/complete"

Write-Host "`n============================================" -ForegroundColor Magenta
Write-Host " TEST COMPLETE" -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta
```

## Example

```bash
/full-lifecycle-test abc123-def456
```

Or let it auto-find a DRAFT procurement:

```bash
/full-lifecycle-test
```

## Expected Output

```
=== Step 1: DRAFT -> SUBMITTED ===
  PASS: status=SUBMITTED
=== Step 2: SUBMITTED -> UNDER_PROCUREMENT_REVIEW ===
  PASS: status=UNDER_PROCUREMENT_REVIEW
...
=== Step 12: AWARD_ANNOUNCED -> COMPLETED ===
  PASS: status=COMPLETED

============================================
 TEST COMPLETE
============================================
```

## Vendor Credentials

Vendor accounts use a **different password** than other roles:

| Role | Password |
|------|----------|
| admin, requester, approver, procurement, evaluator | `password123` |
| **vendor** | **`vendor123`** |

| Vendor Email | Company |
|--------------|---------|
| anurak@smartsystems.co.th | Smart Systems Thailand |
| maria@pacificsupply.com | Pacific Supply Co. |
| james@cloudfirst.io | CloudFirst International |
| nattaya@digitalpartners.co.th | Digital Partners Ltd. |
| somchai@bangkoktech.com | Bangkok Tech Solutions |

**Warning:** Accounts lock after 5 failed login attempts (15-minute lockout).

## Notes

- Creates vendor invitations and has them accept
- Uses first 2 available vendors from the database
- Auto-finds a DRAFT procurement if none specified
- PowerShell 5.1 compatible
- Vendor invitation response is an array directly (not wrapped in `data` property)
