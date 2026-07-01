---
description: Run seed scripts in Docker to set up properties, departments, users, and vendors
---

# Seed Data

Run seed scripts inside Docker containers to populate the database with test data. Handles the common pitfalls of running seeds from Windows vs Docker.

## Usage

```
/seed-data [script] [options]
```

## Arguments

- `$1` or `$ARGUMENTS`: Seed script to run (default: `all`)
  - `all` — Run all seed scripts in order
  - `users` — Seed test users for all properties
  - `properties` — Seed 53 Centara properties
  - `departments` — Seed departments for properties
  - `vendors` — Seed test vendor accounts
  - `procurement` — Seed a test procurement

## What It Does

### ⚠️ Critical: Run Inside Docker

**Never** run seed scripts from Windows directly — they hit local PostgreSQL (password `1234`), not Docker PostgreSQL (password `postgres`). Always use `docker compose exec`.

### Step 1: Ensure Backend Container is Running

```powershell
docker compose ps backend
```

If not running:
```powershell
docker compose up -d backend
```

### Step 2: Run Seed Script

```powershell
# Full seed (all data)
docker compose exec backend npx tsx prisma/seed-centara.ts

# Property users only
docker compose exec backend npx tsx prisma/seed-property-users.ts

# Original seed (basic test data)
docker compose exec backend npx tsx prisma/seed.ts
```

### Step 3: Verify

```powershell
# Check properties count
docker compose exec backend node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.property.count().then(c => { console.log('Properties:', c); p.\$disconnect(); });
"

# Check users count
docker compose exec backend node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.count().then(c => { console.log('Users:', c); p.\$disconnect(); });
"
```

## Seed Scripts Reference

| Script | Purpose | Data Created |
|--------|---------|--------------|
| `prisma/seed.ts` | Basic test data | 8 users, 1 property, 1 dept, 1 vendor, 1 procurement |
| `prisma/seed-centara.ts` | Full Centara properties | 53 properties with codes (AMD, CAK, CNK, etc.) |
| `prisma/seed-property-users.ts` | Property-scoped users | requester-XXX@centara.com + approver-XXX@centara.com per property |

## Property Code Format

53 Centara properties with 3-4 letter codes:
```
AMD, CAK, CNK, CAY, CGCW, CGLB, CHBR, CPBR, CGOJ, CGLM,
CMBR, CHY, CKR, CKV, CKT, CKC, CKD, CCH, CGC, CBP,
CMS, CSA, CMJ, CLOJ, CPP, CWR, CDD, CMLM, CMV, CMO,
NVP, CPY, CRF, CRS, CCM, CSS, CUB, CUD, CPI, CVP,
CSV, CWB, CWQ, CZKA, CZPN, CZSC, CZVL, HHN, CIRM, RKK,
SSA, VKP, WSP
```

## Department Code Format

Department codes are **globally unique** — must be property-prefixed:
```
AMD-FRONT-OFFICE, AMD-HOUSEKEEPING, AMD-FOOD-BEVERAGE, ...
CAK-FRONT-OFFICE, CAK-HOUSEKEEPING, ...
```

**Do NOT reuse codes across properties** — Prisma `@unique` constraint on `Department.code` will reject duplicates.

## User Account Format

| Role | Email Pattern | Password |
|------|---------------|----------|
| Requester | `requester-<property-code>@centara.com` | `password123` |
| Approver | `approver-<property-code>@centara.com` | `password123` |
| Admin | `admin@ebidding.com` | `password123` |
| Vendor | `vendor@ebidding.com` | `password123` |

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Unique constraint failed on the fields: (code)` | Duplicate department codes | Use property-prefixed codes (e.g., `BKK-001-FRONTOFF`) |
| `Error creating UUID, invalid character` | String passed to UUID column | Use real UUIDs or let Prisma generate them |
| `password is not valid` | Weak password hash | Ensure bcrypt hash is generated correctly |
| Connection refused | Running seed from Windows, not Docker | Use `docker compose exec backend npx tsx ...` |
| `Cannot find module '@prisma/client'` | Client not generated | Run `docker compose exec backend npx prisma generate` first |

## Full Reset Sequence

When you need a clean database:

```powershell
# 1. Reset database
docker compose exec backend npx prisma migrate reset --force

# 2. Generate client
docker compose exec backend npx prisma generate

# 3. Run seeds in order
docker compose exec backend npx tsx prisma/seed-centara.ts
docker compose exec backend npx tsx prisma/seed-property-users.ts

# 4. Verify
docker compose exec backend npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
Promise.all([p.property.count(), p.user.count(), p.department.count()])
  .then(([props, users, depts]) => {
    console.log('Properties:', props, 'Users:', users, 'Departments:', depts);
    p.\$disconnect();
  });
"
```

## Notes

- All seed scripts run inside Docker containers
- Docker PostgreSQL password: `postgres` (not `1234`)
- Windows PostgreSQL password: `1234` (local dev only)
- Department `code` is `@unique` globally — never reuse across properties
- Property `code` is also unique — use Centara's official 3-4 letter codes
