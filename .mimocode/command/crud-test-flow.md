---
description: Test a complete CRUD flow: create, edit, delete with validation checks via API
---

# CRUD Test Flow

Test a complete CRUD flow for any entity by logging in as the appropriate role and chaining create → verify → edit → verify → delete → verify API calls.

## Usage

```
/crud-test-flow <entity> <role> [id]
```

## Arguments

- `$1` or `$ARGUMENTS`: Entity to test (e.g., `user`, `vendor`, `procurement`)
- `$2`: Role to test as (e.g., `admin`, `procurement`, `requester`)
- `$3`: Optional existing ID to test edit/delete (skips create)

## What It Does

Chains API calls in a single PowerShell script to test the full lifecycle:

### For Users (admin role):

```powershell
# Login
$token = (Invoke-RestMethod -Uri "http://localhost:80/api/auth/login" -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"admin@ebidding.com","password":"password123"}')
$headers = @{Authorization="Bearer $($token.accessToken)"}

# CREATE
$create = Invoke-RestMethod -Uri "http://localhost:80/api/users" -Method POST `
  -Headers $headers -ContentType "application/json" `
  -Body '{"email":"test-crud@example.com","password":"password123","role":"REQUESTER","firstName":"Test","lastName":"User"}'
Write-Host "Created: $($create.id) - $($create.email)"
$userId = $create.id

# READ (verify exists)
$read = Invoke-RestMethod -Uri "http://localhost:80/api/users/$userId" -Method GET -Headers $headers
Write-Host "Read: $($read.email) - role: $($read.role)"

# UPDATE
$update = Invoke-RestMethod -Uri "http://localhost:80/api/users/$userId" -Method PATCH `
  -Headers $headers -ContentType "application/json" `
  -Body '{"firstName":"Updated","lastName":"Name"}'
Write-Host "Updated: $($update.firstName) $($update.lastName)"

# DELETE
$delete = Invoke-RestMethod -Uri "http://localhost:80/api/users/$userId" -Method DELETE -Headers $headers
Write-Host "Deleted: $($delete.message)"

# VERIFY (should 404)
try {
  Invoke-RestMethod -Uri "http://localhost:80/api/users/$userId" -Method GET -Headers $headers
  Write-Host "ERROR: Should have returned 404!"
} catch {
  Write-Host "Verified: 404 after delete ✓"
}
```

### Validation Tests (run after create):

```powershell
# Invalid email
try {
  Invoke-RestMethod -Uri "http://localhost:80/api/users" -Method POST `
    -Headers $headers -ContentType "application/json" `
    -Body '{"email":"invalid-email","password":"password123","role":"REQUESTER"}'
  Write-Host "ERROR: Should have rejected invalid email!"
} catch {
  Write-Host "Email validation: $($_.Exception.Response.StatusCode) ✓"
}

# Short password
try {
  Invoke-RestMethod -Uri "http://localhost:80/api/users" -Method POST `
    -Headers $headers -ContentType "application/json" `
    -Body '{"email":"valid@test.com","password":"123","role":"REQUESTER"}'
  Write-Host "ERROR: Should have rejected short password!"
} catch {
  Write-Host "Password validation: $($_.Exception.Response.StatusCode) ✓"
}

# Duplicate email
try {
  Invoke-RestMethod -Uri "http://localhost:80/api/users" -Method POST `
    -Headers $headers -ContentType "application/json" `
    -Body '{"email":"test-crud@example.com","password":"password123","role":"REQUESTER"}'
  Write-Host "ERROR: Should have rejected duplicate!"
} catch {
  Write-Host "Duplicate check: $($_.Exception.Response.StatusCode) ✓"
}
```

## Entity-Specific Endpoints

| Entity | Create | Read | Update | Delete |
|--------|--------|------|--------|--------|
| User | `POST /api/users` | `GET /api/users/:id` | `PATCH /api/users/:id` | `DELETE /api/users/:id` |
| Procurement | `POST /api/procurements` | `GET /api/procurements/:id` | `PATCH /api/procurements/:id` | N/A (soft) |

## Role-to-Email Mapping

| Role | Email |
|------|-------|
| admin | admin@ebidding.com |
| procurement | procurement@ebidding.com |
| requester | requester@ebidding.com |
| vendor | vendor@ebidding.com |
| approver | approver@ebidding.com |
| evaluator | evaluator@ebidding.com |

All test passwords: `password123`

## Notes

- Backend runs on port 3000, frontend nginx on port 80
- API base: `http://localhost:80/api` (via nginx proxy)
- PowerShell 5.1 compatible — no `||`, `?.`, `??` operators
- HTTP 500 from missing data ≠ RBAC failure. Only 403 = actual RBAC denial
- Hard delete on users: admin users are protected (returns 400)
