---
description: Test API endpoints with PowerShell by logging in as a role and making authenticated requests
---

# API Test

Test API endpoints by logging in as a specific role and making authenticated requests via PowerShell.

## Usage

```
/api-test <role> <method> <endpoint> [body]
```

## Arguments

- `$1` or `$ARGUMENTS`: Role to test as (e.g., `vendor`, `procurement`, `admin`, `requester`, `approver`, `evaluator`)
- Followed by: HTTP method, endpoint path, optional JSON body

## What It Does

1. Logs in as the specified role using the e-bidding auth API
2. Makes the requested API call with the JWT token
3. Displays the response in a readable format

## Examples

```bash
# Test vendor analytics
/api-test vendor GET /api/analytics/vendor

# Test procurement stats as admin
/api-test admin GET /api/procurements/stats

# Test creating an invitation as procurement
/api-test procurement POST /api/vendor-invitations '{"procurementId":"xxx","vendorIds":["yyy"]}'

# Test vendor accepting invitation
/api-test vendor PUT /api/vendor-invitations/{id}/accept

# Check vendor dashboard stats
/api-test vendor GET /api/analytics/vendor

# Check buyer/requester dashboard
/api-test requester GET /api/procurements?limit=50

# Test admin dashboard with users and vendors count
/api-test admin GET /api/procurements/stats
```

## PowerShell Template

The command generates a PowerShell script following this pattern:

```powershell
# Login
$token = (Invoke-RestMethod -Uri "http://localhost:80/api/auth/login" -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"<role>@ebidding.com","password":"password123"}')

# Make authenticated request
$result = Invoke-RestMethod -Uri "http://localhost:80<endpoint>" `
  -Method <METHOD> `
  -Headers @{Authorization="Bearer $($token.accessToken)"} `
  -ContentType "application/json"

# Output
$result | ConvertTo-Json -Depth 5
```

## Role-to-Email Mapping

| Role | Email |
|------|-------|
| vendor | vendor@ebidding.com |
| procurement | procurement@ebidding.com |
| admin | admin@ebidding.com |
| requester | requester@ebidding.com |
| approver | approver@ebidding.com |
| evaluator | evaluator@ebidding.com |
| lead_evaluator | lead_evaluator@ebidding.com |

All test passwords: `password123`

## Common Test Scenarios

### Dashboard Stats Verification
```bash
# Vendor stats
/api-test vendor GET /api/analytics/vendor

# Procurement/admin stats
/api-test admin GET /api/procurements/stats

# Vendor performance
/api-test vendor GET /api/analytics/vendor/performance
```

### Invitation Flow
```bash
# Send invitation
/api-test procurement POST /api/vendor-invitations '{"procurementId":"PROC_ID","vendorIds":["VENDOR_ID"]}'

# Accept invitation
/api-test vendor PUT /api/vendor-invitations/INV_ID/accept

# Decline invitation
/api-test vendor PUT /api/vendor-invitations/INV_ID/decline
```

### Workflow Transitions
```bash
# Submit procurement
/api-test requester POST /api/procurements/PROC_ID/submit

# Start review
/api-test procurement POST /api/procurements/PROC_ID/review/start

# Approve
/api-test procurement POST /api/procurements/PROC_ID/review/approve
```

## Bulk Workflow Testing

For testing complete workflows across multiple roles, chain API calls in a single script with intermediate variables.

### RFP Workflow (Full Lifecycle)
```powershell
# Step 1: Login as requester, submit procurement
$req = (Invoke-RestMethod -Uri "http://localhost:80/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"requester@ebidding.com","password":"password123"}')
$sub = Invoke-RestMethod -Uri "http://localhost:80/api/procurements/{PROC_ID}/submit" -Method POST -Headers @{Authorization="Bearer $($req.accessToken)"}
Write-Host "Submitted: $($sub.status)"

# Step 2: Login as procurement, review + approve
$proc = (Invoke-RestMethod -Uri "http://localhost:80/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"procurement@ebidding.com","password":"password123"}')
$review = Invoke-RestMethod -Uri "http://localhost:80/api/procurements/{PROC_ID}/review/start" -Method POST -Headers @{Authorization="Bearer $($proc.accessToken)"}
$approve = Invoke-RestMethod -Uri "http://localhost:80/api/procurements/{PROC_ID}/review/approve" -Method POST -Headers @{Authorization="Bearer $($proc.accessToken)"}
Write-Host "Approved: $($approve.status)"

# Step 3: Login as procurement, publish
$publish = Invoke-RestMethod -Uri "http://localhost:80/api/procurements/{PROC_ID}/publish" -Method POST -Headers @{Authorization="Bearer $($proc.accessToken)"} -Body '{"submissionDeadline":"2026-07-01T00:00:00.000Z"}'
Write-Host "Published: $($publish.status)"

# Step 4: Login as vendor, place bid
$vend = (Invoke-RestMethod -Uri "http://localhost:80/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"vendor@ebidding.com","password":"password123"}')
$bid = Invoke-RestMethod -Uri "http://localhost:80/api/ebidding/bid" -Method POST -Headers @{Authorization="Bearer $($vend.accessToken)"} -Body '{"roundId":"ROUND_ID","amount":95000}'
Write-Host "Bid placed: $($bid.amount)"

# Step 5: Login as approver, approve award
$app = (Invoke-RestMethod -Uri "http://localhost:80/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"approver@ebidding.com","password":"password123"}')
$award = Invoke-RestMethod -Uri "http://localhost:80/api/procurements/{PROC_ID}/approval/approve" -Method POST -Headers @{Authorization="Bearer $($app.accessToken)"}
Write-Host "Awarded: $($award.status)"
```

### RBAC Smoke Test (All Roles × One Endpoint)
```powershell
$roles = @("admin","procurement","approver","evaluator","lead_evaluator","vendor","requester")
$endpoint = "/api/procurements/stats"

foreach ($role in $roles) {
  $login = (Invoke-RestMethod -Uri "http://localhost:80/api/auth/login" -Method POST -ContentType "application/json" -Body "{`"email`":`"$role@ebidding.com`",`"password`":`"password123`"}")
  try {
    $result = Invoke-RestMethod -Uri "http://localhost:80$endpoint" -Method GET -Headers @{Authorization="Bearer $($login.accessToken)"}
    Write-Host "[$role] OK - $($result.total) records"
  } catch {
    Write-Host "[$role] FAILED - $($_.Exception.Response.StatusCode)"
  }
}
```

### Dashboard Stats (All Roles)
```powershell
$endpoints = @{
  "admin" = "/api/procurements/stats"
  "procurement" = "/api/procurements/stats"
  "approver" = "/api/procurements/stats"
  "vendor" = "/api/analytics/vendor"
  "requester" = "/api/procurements?limit=50"
}

foreach ($role in $endpoints.Keys) {
  $login = (Invoke-RestMethod -Uri "http://localhost:80/api/auth/login" -Method POST -ContentType "application/json" -Body "{`"email`":`"$role@ebidding.com`",`"password`":`"password123`"}")
  $result = Invoke-RestMethod -Uri "http://localhost:80$($endpoints[$role])" -Method GET -Headers @{Authorization="Bearer $($login.accessToken)"}
  Write-Host "[$role] $($endpoints[$role]) -> OK"
}
```

## Notes

- Backend runs on port 3000, frontend nginx on port 80
- API base: `http://localhost:80/api` (via nginx proxy)
- PowerShell 5.1 compatible — no `||`, `?.`, `??` operators
- For bulk testing, chain multiple API calls in one script with intermediate variables
- RBAC: HTTP 500 from missing data ≠ RBAC failure. Only 403 = actual RBAC denial
