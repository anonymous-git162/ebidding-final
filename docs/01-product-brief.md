# CenBidding Platform — Product Brief & Scope

## Vision
Enterprise-grade E-Bidding web application for multi-property procurement lifecycle management.

## Core Modules
1. **Procurement Management** — Create/manage RFI, RFP, RFQ requests
2. **Vendor Management** — Vendor master data, invitations, proposals
3. **E-Bidding Module** — Multi-round blind bidding
4. **Evaluation Module** — Multi-evaluator scoring, AI assist, lead consolidation
5. **Approval Workflow** — Multi-step approval with return/reject
6. **Audit & Timeline** — Full audit trail and timeline events

## Roles (RBAC)
| Role | Capabilities |
|------|-------------|
| Requester | Create/edit/submit requests, view own |
| Procurement | Review, publish, invite vendors, manage bidding, assign evaluators |
| Vendor | Accept invitations, submit proposals, place bids (see only own) |
| Evaluator | Score assigned vendors, submit reviews |
| Lead Evaluator | Same as evaluator + final recommendation |
| Approver | Review final package, approve/return/reject |
| Admin | Full access, user management |

## Status Flow
Draft → Submitted → Under Review → Approved → Published → Vendor Response → Bidding → Evaluation → Approval → Completed

## Non-Functional Requirements
- JWT auth with refresh tokens
- Role-based UI dashboards
- Responsive design (desktop-first, mobile-friendly)
- Swagger API docs
- Audit trail on every action
- Vendor visibility restriction (losers see "Not Selected" only)

## Tech Stack
- Frontend: React 19 + TypeScript + MUI 5 + Vite 6
- Backend: NestJS + TypeScript + Prisma 6 + PostgreSQL 16
- Auth: JWT + bcrypt
