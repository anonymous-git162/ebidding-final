---
description: Run the full Prisma schema migration cycle: generate, migrate, rebuild, verify
---

# Backend Reset

Run the complete Prisma migration cycle after schema changes: generate client → create migration → rebuild container → verify backend starts.

## Usage

```
/backend-reset [migration-name]
```

## Arguments

- `$1` or `$ARGUMENTS`: Migration name (e.g., `add_user_lockout`, `add_department_unique`). If omitted, uses `dev` as default.

## What It Does

Executes the 4-step Prisma migration cycle that must happen every time `schema.prisma` changes:

### Step 1: Generate Prisma Client
```powershell
node ./node_modules/prisma/build/index.js generate 2>&1
```
Workdir: `C:\Users\CGCWIT\Desktop\project\backend`

This regenerates TypeScript types from the updated schema. Must succeed before `tsc` can compile.

### Step 2: Create Migration
```powershell
node ./node_modules/prisma/build/index.js migrate dev --name $migrationName 2>&1
```

Creates the SQL migration file and applies it to the local DB. For Docker, the migration auto-applies on container start.

### Step 3: Rebuild Container
```powershell
docker compose build --no-cache backend 2>&1 | Select-Object -Last 10
docker compose up -d backend 2>&1 | Select-Object -Last 5
```
Workdir: `C:\Users\CGCWIT\Desktop\project`

`--no-cache` is critical — Docker layer caching will serve stale code without it.

### Step 4: Verify
```powershell
docker logs project-backend-1 2>&1 | Select-Object -Last 5
Invoke-RestMethod -Uri "http://localhost:3000/api/docs" -Method GET
```

Check that the backend started successfully and the Swagger docs are accessible.

## Common Issues

| Error | Cause | Fix |
|-------|-------|-----|
| `WhereUniqueInput` type missing field | `@unique` not regenerated | Run `npx prisma generate` again |
| `Error creating UUID, invalid character` | String passed to UUID column | Use real UUIDs in seed data |
| `Unique constraint failed` | Duplicate codes in seed | Use property-prefixed codes (e.g., `BKK-001-FRONTOFF`) |
| Container serves stale code | Docker layer cache | Use `--no-cache` on build |
| `Cannot find module '@prisma/client'` | Client not generated | Run `npx prisma generate` |

## Quality Checklist

- [ ] `prisma generate` succeeds with 0 errors
- [ ] `prisma migrate dev` creates migration file
- [ ] Backend container rebuilds with `--no-cache`
- [ ] Backend starts without errors (`docker logs` clean)
- [ ] Swagger docs accessible at `/api/docs`
