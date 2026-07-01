---
name: six-agent-workflow
description: Complete enterprise application development using 6-agent workflow (Product → UX → Build → QA → Release)
---

# Six-Agent Workflow

Complete enterprise application development using 6-agent workflow.

## When to Use

- Building a new enterprise application from scratch
- Major feature development requiring multiple roles
- Projects that need product, UX, development, QA, and release phases

## The 6 Agents

### 1. Product Agent
**Goal:** Define what to build and why

**Deliverables:**
- Product brief (`docs/01-product-brief.md`)
- User roles and permissions
- Feature requirements
- Business rules

**Quality Gate:**
- [ ] All user roles defined
- [ ] All features listed with acceptance criteria
- [ ] Business rules documented
- [ ] Technical constraints noted

### 2. UX Agent
**Goal:** Define how it looks and feels

**Deliverables:**
- UX plan (`docs/02-ux-plan.md`)
- Navigation structure
- User journeys
- Wireframes/mockups
- Design system

**Quality Gate:**
- [ ] Navigation hierarchy defined
- [ ] All user journeys mapped
- [ ] Design system documented
- [ ] Responsive strategy defined

### 3. Frontend Agent
**Goal:** Build the user interface

**Deliverables:**
- React/TypeScript components
- Pages and routing
- State management
- API integration

**Quality Gate:**
- [ ] All pages implemented
- [ ] TypeScript compiles with 0 errors
- [ ] Build passes
- [ ] All empty states handled

### 4. Backend Agent
**Goal:** Build the API and data layer

**Deliverables:**
- NestJS/Express API
- Database schema (Prisma)
- Authentication/authorization
- Business logic

**Quality Gate:**
- [ ] All endpoints implemented
- [ ] TypeScript compiles with 0 errors
- [ ] Build passes
- [ ] Database migrations work

### 5. QA Agent
**Goal:** Find and fix issues

**Deliverables:**
- QA audit report
- Bug fixes
- Performance improvements
- Accessibility fixes

**Quality Gate:**
- [ ] All critical bugs fixed
- [ ] TypeScript 0 errors
- [ ] Build passes
- [ ] No console errors

### 6. Release Agent
**Goal:** Prepare for deployment

**Deliverables:**
- Release notes (`docs/03-release-notes.md`)
- Deployment checklist
- Environment configuration
- Monitoring setup

**Quality Gate:**
- [ ] Release notes complete
- [ ] Deployment checklist ready
- [ ] Environment variables documented
- [ ] Health checks working

## Workflow Execution

### Step 1: Product Phase
```
User: "Let's define the product requirements"
Agent: Create docs/01-product-brief.md
```

### Step 2: UX Phase
```
User: "Now let's plan the UX"
Agent: Create docs/02-ux-plan.md
```

### Step 3: Build Phase (Frontend + Backend)
```
User: "Let's build the frontend"
Agent: Build React components and pages

User: "Now build the backend"
Agent: Build NestJS API and database
```

### Step 4: QA Phase
```
User: "Let's do a QA audit"
Agent: Run QA audit, fix issues
```

### Step 5: Release Phase
```
User: "Prepare for release"
Agent: Create release notes and checklist
```

## Quality Gates

### Build Quality Gate
- TypeScript compiles with 0 errors
- Build passes (`npm run build`)
- No console errors

### Code Quality Gate
- All components have loading states
- All components have error states
- All components have empty states (where applicable)
- All icons use `<Icon name="X" />` pattern

### Release Quality Gate
- Product brief complete
- UX plan complete
- All pages implemented
- QA audit passed
- Release notes complete

## Example Execution

### E-Bidding Platform (Completed)

**Product Phase:**
- Defined 7 roles (Requester, Procurement, Vendor, Evaluator, Lead Evaluator, Approver, Admin)
- Defined 3 procurement paths
- Defined 16 procurement statuses

**UX Phase:**
- Designed workflow-oriented workspaces
- Designed role-based navigation
- Designed enterprise color palette

**Build Phase:**
- Built 15+ pages covering full procurement lifecycle
- Built 15 NestJS modules
- Implemented JWT auth with RBAC

**QA Phase:**
- Fixed 13 QA issues
- Added empty states to all pages
- Fixed MUI v5 compatibility issues

**Release Phase:**
- Created release notes
- Documented deployment checklist
- Verified build passes

## Notes

- This workflow is iterative - you may revisit earlier phases
- Quality gates must pass before moving to next phase
- Document decisions in `docs/` directory
- Keep memory files updated with discoveries