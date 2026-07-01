---
name: sprint-page-builder
description: Build React/MUI pages in sprints following consistent patterns for enterprise applications
---

# Sprint Page Builder

Build React/MUI pages in sprints following consistent patterns for enterprise applications.

## When to Use

- Building multiple pages in a sprint cycle
- Creating enterprise-grade React pages with MUI v9
- Following a consistent page structure across a procurement/business application

## Workflow

### 1. Plan the Sprint
- Review the sprint goals (e.g., "Sprint 2 - Core Procurement Flow")
- List the pages to build
- Check existing pages for patterns to follow

### 2. Build Each Page
For each page, follow this template:

```typescript
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, // ... MUI components
} from '@mui/material';
import { Icon } from '../components/Icon';
import { serviceName } from '../services/serviceName';
import { TypeName } from '../types/typeName';

export const PageName: React.FC = () => {
  // State
  const [data, setData] = useState<TypeName[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Hooks
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  // Effects
  useEffect(() => {
    fetchData();
  }, []);
  
  // Handlers
  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await serviceName.getData();
      setData(result);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };
  
  // Render
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  
  return (
    <Box>
      {/* Page content */}
    </Box>
  );
};
```

### 3. Key Patterns to Follow

#### MUI v9 API (CRITICAL)
- **Grid**: Use `size` prop, not `item` + `xs`
  ```tsx
  <Grid size={{ xs: 12, md: 6 }}> {/* CORRECT */}
  <Grid item xs={6}> {/* WRONG - v9 removed */}
  ```

- **Typography**: Use `sx` for styling
  ```tsx
  <Typography sx={{ fontWeight: 'bold' }}> {/* CORRECT */}
  <Typography fontWeight="bold"> {/* WRONG - v9 removed */}
  ```

- **TextField**: Use `slotProps`
  ```tsx
  <TextField slotProps={{ input: { startAdornment: <Icon name="Search" /> } }} /> {/* CORRECT */}
  <TextField InputProps={{ startAdornment: <Icon name="Search" /> }} /> {/* WRONG */}
  ```

- **Date inputs**: Always use
  ```tsx
  <TextField
    type="date"
    slotProps={{ inputLabel: { shrink: true } }}
  />
  ```

- **StepLabel**: Use `slotProps.stepIcon`
  ```tsx
  <StepLabel slotProps={{ stepIcon: { component: () => <Box>...</Box> } }}> {/* CORRECT */}
  <StepLabel StepIconComponent={() => <Box>...</Box>}> {/* WRONG */}
  ```

#### Icons
- Always use `<Icon name="IconName" />` component
- Never import from `@mui/icons-material` directly
- Check `Icon.tsx` for available icon names

#### State Management
- Use `useState` for local state
- Use `useEffect` for data fetching
- Use `useCallback` for event handlers
- Use `useRef` for timers/debounce

#### Error Handling
- Show loading states with `CircularProgress` or `LinearProgress`
- Show error states with `Alert` or custom error component
- Show empty states when no data

### 4. Verify Build
After building each page:
```bash
npm run build 2>&1
```

Fix any TypeScript errors before moving to the next page.

## Quality Checklist

- [ ] Uses MUI v9 API patterns (size, sx, slotProps)
- [ ] Uses `<Icon name="X" />` for all icons
- [ ] Has loading state
- [ ] Has error state
- [ ] Has empty state (if applicable)
- [ ] TypeScript compiles with 0 errors
- [ ] Build passes

## Example Sprints

### Sprint 2 - Core Procurement Flow
- ProcurementCreatePage (4-step stepper)
- ProcurementDetailPage (workspace layout)
- InvitationsPage (bulk actions)
- ProcurementListPage (filterable table)
- RFQSubmissionPage (3-step form)

### Sprint 3 - All 3 Workflow Paths
- BiddingRoomPage (round management)
- EvaluationPage (scoring matrix)
- ApprovalPage (multi-step workflow)

### Sprint 4 - Results + Governance
- ResultsPage (vendor restricted view)
- AuditLogsPage (filtering + export)
- DashboardPage (role-based KPIs)