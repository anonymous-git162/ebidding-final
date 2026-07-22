# CenBidding Platform — Release Notes

## Version: 1.0.0 (MVP)
**Date**: 2026-06-21

---

## Changelog

### Fixed (from QA)
- **AuditPage**: Added debounce via Search button (was firing API on every keystroke)
- **AuditPage**: Added empty state message when no logs found
- **AuditPage**: Fixed broken `<History />` icon → now uses `<Icon name="History" />`
- **BiddingRoomPage**: Added missing `SelectProps={{ native: true }}` on procurement dropdown
- **BiddingRoomPage**: Added empty state when no bidding rounds exist
- **DashboardPage**: Fixed undefined icon names `"Pending"` → `"Send"`, `"TrendingUp"` → `"Gavel"`
- **EvaluationPage**: Added empty state for Vendor Scores and Reviews tables
- **LoginPage**: Simplified show/hide password to text button (removed broken MUI icon refs)
- **SubmissionsPage**: Added empty state for no open RFQs, table listing existing RFQs
- **ApprovalsPage/ResultsPage/VendorsPage**: Fixed TableCell `fontWeight` prop → `sx={{ fontWeight: 600 }}`
- **api.ts**: Added redirect to `/login` when 401 occurs without refresh token
- **AppRoutes**: Added loading spinner with CircularProgress, added 404 route
- **AppShell**: Fixed semantic HTML (replaced empty Typography heading with Box spacer)

### Added
- Custom SVG Icon component (30 icons) replacing @mui/icons-material dependency
- Production Docker configuration (backend + frontend + nginx)
- Swagger API docs at `/api/docs`
- Seed data for all 7 roles with test credentials
- Health check endpoint at `/api/health`

---

## Quality Gate Checklist

### Code Quality
- [x] TypeScript compilation: 0 errors (backend + frontend)
- [x] Vite production build: passes (7.03s)
- [x] All JSX component tags resolve to imported definitions
- [x] No undefined variables or missing imports

### Functionality
- [x] Login/Register/Logout flow with JWT + refresh tokens
- [x] Role-based navigation (sidebar changes per role)
- [x] Procurement CRUD with workflow state machine
- [x] Vendor invitation and acceptance flow
- [x] RFQ submission system
- [x] E-bidding rounds (create, open, close, bid)
- [x] Multi-evaluator scoring with aggregation
- [x] Approval workflow (approve/return/reject)
- [x] Winner announcement with vendor visibility restriction
- [x] Audit log and timeline tracking
- [x] File upload/download

### UX & Responsive
- [x] Mobile-responsive sidebar (collapses to drawer on md breakpoint)
- [x] Loading states on all async operations
- [x] Empty states on all list/table views
- [x] Error feedback via Alert components
- [x] Consistent status badges across pages

### Security
- [x] JWT auth with refresh token rotation
- [x] bcrypt password hashing
- [x] Role-based access control (RBAC)
- [x] Input validation via class-validator DTOs
- [x] Vendor visibility restriction (losers see "Not Selected" only)
- [x] CORS configured for frontend origin

### API
- [x] All endpoints documented via Swagger
- [x] Consistent response format { success, data, message, meta }
- [x] Workflow state machine prevents illegal transitions
- [x] Timeline appended on every important action
- [x] Audit log created for all mutations

---

## Handoff Notes

### Running Locally
```bash
# 1. Start PostgreSQL (port 5432)

# 2. Backend
cd backend
npx prisma migrate dev --name init
npx tsx prisma/seed.ts
npx nest build
node dist/src/main.js
# → http://localhost:3000
# → http://localhost:3000/api/docs

# 3. Frontend
cd frontend
npm run dev
# → http://localhost:5173
```

### Test Credentials (password: `password123`)
| Role | Email |
|------|-------|
| Admin | admin@ebidding.com |
| Requester | requester@ebidding.com |
| Procurement | procurement@ebidding.com |
| Evaluator | evaluator@ebidding.com |
| Lead Evaluator | lead@ebidding.com |
| Approver | approver@ebidding.com |
| Vendor | vendor@ebidding.com |

### Known Limitations (MVP)
1. No email notifications (in-app only)
2. No multi-language support
3. No SSO/LDAP integration

### Next Phase Recommendations
1. Integrate email service for notifications
2. Add reporting/analytics dashboard
3. Add multi-property data scoping
4. Add E2E tests (Cypress/Playwright)
