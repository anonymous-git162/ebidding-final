# eBidding Platform — AGENTS.md

## Project Structure
```
ebidding-final/
├── backend/          # NestJS 11 + Prisma + PostgreSQL
│   ├── src/
│   │   ├── modules/  # Feature modules (auth, procurements, ebidding, etc.)
│   │   ├── common/   # Shared guards, decorators, enums, DTOs
│   │   └── database/ # PrismaService
│   ├── test/         # E2E tests + prisma-mock
│   └── prisma/       # Schema + seed
├── frontend/         # React 19 + Vite + MUI 5
│   └── src/
│       ├── pages/    # Page components (one per route)
│       ├── components/ # Shared components (Icon, StatusBadge)
│       ├── contexts/ # AuthContext, ThemeContext
│       ├── hooks/    # useSocket
│       ├── services/ # api.ts (axios)
│       └── test/     # Vitest tests
└── docs/             # Workflow documentation
    └── 04-workflow.md # State machine, transitions, workflow sections
```

## Commands

### Backend
| Command | Description |
|---------|-------------|
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run E2E tests (requires PostgreSQL) |
| `npm run test:cov` | Unit tests with coverage |
| `npm run lint` | ESLint fix |
| `npm run build` | Compile NestJS |
| `npx tsc --noEmit` | TypeScript check |

### Frontend
| Command | Description |
|---------|-------------|
| `npm test` | Run Vitest |
| `npm run test:watch` | Watch mode |
| `npm run build` | Vite build |
| `npx tsc --noEmit` | TypeScript check |
| `npx playwright test` | Run Playwright e2e tests |

### Other
| Command | Description |
|---------|-------------|
| `npm test` | Run root-level checks |

## Coding Conventions

### Backend
- All controllers use `@UseGuards(JwtAuthGuard)` at class level + `@Roles()` per endpoint
- Services inject `PrismaService` (mocked via `test/prisma-mock.ts` in unit tests)
- Unit tests go next to the source file: `*.spec.ts`
- DTOs use `class-validator` decorators (whitelist: true globally)
- Workflow transitions validated via `WORKFLOW_TRANSITIONS` enum map
- Notifications sent via `NotificationsService.create()` / `createForUsers()`
- `@Body() body: any` is NOT allowed — use typed DTOs or inline types

### Frontend
- Pages go in `src/pages/`, components in `src/components/`
- All API calls go through `src/services/api.ts` (axios instance)
- Auth state via `useAuth()` from `AuthContext`
- MUI components with `elevation={0}` + `border: '1px solid', borderColor: 'divider'` for cards
- Icons via `<Icon name="..." />` component (not MUI icons)
- Tests in `src/test/` using Vitest + @testing-library/react
- Mocks: `vi.mock('../services/api')` and `vi.mock('../contexts/AuthContext')`

## Security Rules
- No hardcoded secrets in code or committed `.env` files
- Passwords: min 8 chars, uppercase + lowercase + number
- Token storage: `sessionStorage` (not `localStorage`)
- Auth guards required on ALL controllers
- Error messages must not leak system details

## Test Results (July 2026)

| Suite | Type | Count | Status |
|-------|------|-------|--------|
| Backend unit tests | Jest | 367 (43 suites) | ✅ Passed |
| Frontend unit tests | Vitest | 179 (28 files) | ✅ Passed |
| Backend TypeScript | `tsc --noEmit` | — | ✅ Clean |
| Frontend TypeScript | `tsc --noEmit` | — | ✅ Clean |
| Backend e2e | Supertest | 101 (14 suites) | ✅ Passed |
| Playwright e2e | Playwright | 50 | ✅ Passed (inc. fix: `/review` → `/reviews` in lifecycle test, added missing mock in vendor-flow test) |

## Test Patterns

### Backend unit test mock
```ts
const prisma = mockPrisma();
// Provide in module:
{ provide: PrismaService, useValue: prisma }
// Mock DB calls:
prisma.user.findUnique.mockResolvedValue(mockUser);
prisma.procurement.create.mockResolvedValue(mockProcurement);
```

### Frontend component test mock
```ts
vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: '1', role: 'ADMIN' }, login: vi.fn(), logout: vi.fn(), isLoading: false }),
}));
```
