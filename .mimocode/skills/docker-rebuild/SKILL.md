---
name: docker-rebuild
description: Diagnose Docker build failures, fix TypeScript errors, and rebuild containers
---

# Docker Rebuild

Diagnose Docker build failures, fix TypeScript/compilation errors, and rebuild containers. Covers the repeated build-fix-rebuild cycle common in Dockerized full-stack projects.

## When to Use

- `docker compose up --build -d` fails with compilation errors
- Frontend or backend build fails inside Docker but may work locally
- Need to iterate through multiple build-fix-rebuild cycles
- After making code changes that need container rebuild

## Workflow

### 1. Attempt Build
```powershell
docker compose up --build -d 2>&1 | Select-Object -Last 10
```
Workdir: project root (where `docker-compose.yml` lives)

### 2. Diagnose Failure

If the build fails, extract specific errors:

```powershell
# Frontend errors
docker compose build --no-cache frontend 2>&1 | Select-String "error" | Select-Object -First 10

# Backend errors
docker compose build --no-cache backend 2>&1 | Select-String "error" | Select-Object -First 10
```

### 3. Common Error Patterns & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `TS2304: Cannot find name 'X'` | Missing MUI import | Add `X` to the `@mui/material` import line |
| `TS6133: 'X' is declared but never read` | Unused import | Remove from import statement |
| `TS2339: Property 'X' does not exist on type` | Wrong MUI v9 prop | Use v9 API: `size` not `item`+`xs`, `sx` not direct props, `slotProps` not `InputProps` |
| `Module not found` | Missing npm package | Run `npm install <package>` inside container or add to Dockerfile |
| `Cannot find module '../components/Icon'` | Wrong import path | Verify relative path from the file's location |

### 4. Fix and Rebuild
```powershell
# Apply fixes using edit tool, then:
docker compose up --build -d 2>&1 | Select-Object -Last 5
```

### 5. Verify
```powershell
# Check containers are running
docker compose ps

# Check backend health
Invoke-RestMethod -Uri "http://localhost:3000/api/docs" -Method GET

# Check frontend
Invoke-RestMethod -Uri "http://localhost:80" -Method GET
```

## Windows-Specific Notes

- PowerShell 5.1: No `||`, `?.`, or `??` operators — use `if` statements
- Working directory for Docker commands: must be where `docker-compose.yml` lives
- `docker compose up --build -d` is the standard rebuild command
- Use `--force-recreate` when source file changes aren't picked up by cache

## Quality Checklist

- [ ] Build completes with 0 errors
- [ ] All containers running (`docker compose ps`)
- [ ] Backend health check passes
- [ ] Frontend serves the SPA
- [ ] No stale build artifacts (use `--force-recreate` if needed)
