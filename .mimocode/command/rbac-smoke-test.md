---
description: Run RBAC smoke test across all roles for a specific endpoint
---

# RBAC Smoke Test

Test RBAC authorization for a specific endpoint by logging in as every role and checking which get 200 vs 403. Follows the methodology established in the 232-test regression suite.

## Usage

```
/rbac-smoke-test <method> <endpoint> [expected-allowed-roles]
```

## Arguments

- `$1` or `$ARGUMENTS`: HTTP method (GET, POST, PATCH, DELETE)
- `$2`: Endpoint path (e.g., `/api/procurements/stats`, `/api/users`)
- `$3` (optional): Comma-separated roles expected to be allowed (for assertion)

## What It Does

1. Logs in as each of the 7 roles
2. Makes the same API call with each role's JWT token
3. Reports which roles get 200/201 (allowed) vs 403 (denied) vs 500 (data-dependent)
4. Optionally asserts expected results

## PowerShell Template

```powershell
$roles = @("admin","procurement","approver","evaluator","lead_evaluator","vendor","requester")
$method = "<METHOD>"
$endpoint = "/api/<ENDPOINT>"

foreach ($role in $roles) {
  $login = (Invoke-RestMethod -Uri "http://localhost:80/api/auth/login" -Method POST `
    -ContentType "application/json" `
    -Body "{`"email`":`"$role@ebidding.com`",`"password`":`"password123`"}")
  try {
    $result = Invoke-RestMethod -Uri "http://localhost:80$endpoint" `
      -Method $method `
      -Headers @{Authorization="Bearer $($login.accessToken)"} `
      -ContentType "application/json"
    Write-Host "[$role] ✅ ALLOWED — 200/201"
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 403) {
      Write-Host "[$role] 🚫 DENIED — 403"
    } else {
      Write-Host "[$role] ⚠️  $status — may be data-dependent"
    }
  }
}
```

## Examples

```bash
# Test who can view procurement stats
/rbac-smoke-test GET /api/procurements/stats

# Test who can create users (should be admin only)
/rbac-smoke-test POST /api/users admin

# Test who can approve procurements
/rbac-smoke-test POST /api/procurements/PROC_ID/approval/approve approver,admin

# Test who can view audit logs
/rbac-smoke-test GET /api/audit admin,approver,procurement
```

## Role-to-Email Mapping

| Role | Email |
|------|-------|
| admin | admin@ebidding.com |
| procurement | procurement@ebidding.com |
| approver | approver@ebidding.com |
| evaluator | evaluator@ebidding.com |
| lead_evaluator | lead_evaluator@ebidding.com |
| vendor | vendor@ebidding.com |
| requester | requester@ebidding.com |

All test passwords: `password123`

## Interpreting Results

| Status | Meaning |
|--------|---------|
| 200/201 | Role is allowed — endpoint works |
| 403 | Role is denied — RBAC is working correctly |
| 404 | Resource not found (not an RBAC issue) |
| 500 | Data-dependent error (e.g., missing foreign key) — not RBAC |

**Key rule:** HTTP 500 from missing data ≠ RBAC failure. Only 403 = actual RBAC denial.

## Common Endpoint → Expected Roles

| Endpoint | Allowed Roles |
|----------|---------------|
| `GET /api/procurements/stats` | admin, procurement, approver |
| `POST /api/users` | admin |
| `PATCH /api/users/:id` | admin |
| `DELETE /api/users/:id` | admin |
| `POST /api/procurements/:id/approval/approve` | approver, admin |
| `POST /api/procurements/:id/review/approve` | procurement |
| `GET /api/audit` | admin, approver, procurement |
| `GET /api/analytics/vendor` | vendor |
| `POST /api/ebidding/bid` | vendor |
| `GET /api/evaluation/assignments` | evaluator, lead_evaluator |

## Notes

- Backend runs on port 3000, frontend nginx on port 80
- API base: `http://localhost:80/api` (via nginx proxy)
- PowerShell 5.1 compatible — no `||`, `?.`, `??` operators
- For POST/PATCH, you may need to pass a body — use valid test data or check endpoint accepts empty body
