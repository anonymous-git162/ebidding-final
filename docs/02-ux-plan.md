# E-Bidding Platform — UX Plan & User Journey

## Navigation Structure (Role-Based Sidebar)
```
PROCUREMENT ROLE:           VENDOR ROLE:              EVALUATOR ROLE:
├── Dashboard               ├── Dashboard             ├── Dashboard
├── Procurements            ├── My Invitations        ├── Evaluation Queue
├── Vendors                 ├── Submissions
├── Invitations             ├── Bidding
├── Bidding                 └── Results
├── Evaluation
├── Approvals
├── Results
└── Audit Logs

REQUESTER ROLE:             APPROVER ROLE:
├── Dashboard               ├── Dashboard
└── My Requests             └── Approval Inbox
```

## Key User Journeys

### Journey 1: Requester Creates RFP
1. Login → Dashboard (sees KPI cards + recent items)
2. Click "New Request" → Create Form
3. Fill: title, description, business need, category, budget
4. Click "Submit for Review" → Status changes to SUBMITTED
5. See timeline update in detail page

### Journey 2: Procurement Reviews & Publishes
1. Dashboard → sees pending reviews count
2. Click procurement → See full detail with Overview/Vendors/Submissions/Evaluation tabs
3. Review and click Approve → Status: APPROVED
4. Click Publish → Set deadline → Status: RFP_PUBLISHED
5. Invite vendors from Invitation Manager

### Journey 3: Vendor Responds
1. Login → My Invitations → See pending invitations
2. Accept invitation
3. Go to Submissions → Create proposal (price + text)
4. Submit before deadline
5. Optional: Enter Bidding Room → Place bids per round

### Journey 4: Evaluator Scores
1. Login → Evaluation Queue → Select procurement
2. See vendor comparison table with prices
3. Score each vendor (0-100 slider) + comment
4. Submit reviews
5. Lead evaluator: Consolidate scores + recommendation

### Journey 5: Approver Decides
1. Login → Approval Inbox → See pending items
2. Click to view full procurement detail
3. Review evaluation results + timeline
4. Approve, Return, or Reject with comment
5. Winner announced → Losing vendors see "Not Selected"

## Screen Layout Pattern
```
┌──────────────────────────────────────────────┐
│  Topbar (Logo + User Avatar + Menu)          │
├──────────┬───────────────────────────────────┤
│ Sidebar  │  Content Area                     │
│          │                                   │
│ Nav      │  ┌─ Page Header + Actions ─────┐  │
│ Items    │  │                             │  │
│          │  │  ┌─ KPI Cards ────────────┐  │  │
│          │  │  └────────────────────────┘  │  │
│          │  │  ┌─ Data Table / Content ─┐  │  │
│          │  │  │                        │  │  │
│ [User]   │  │  └────────────────────────┘  │  │
│          │  └─────────────────────────────┘  │
├──────────┴───────────────────────────────────┤
│  (Mobile: sidebar collapses to drawer)       │
└──────────────────────────────────────────────┘
```

## Design System
- Primary: #1E3A8A (Deep Blue)
- Secondary: #2563EB (Bright Blue)
- Success: #16A34A | Warning: #F59E0B | Error: #DC2626
- Background: #F8FAFC | Surface: #FFFFFF
- Font: Inter / Roboto
- Cards: soft shadow, 8px border radius
- Tables: sticky headers, row hover, compact mode
- Status badges: colored chips per status
