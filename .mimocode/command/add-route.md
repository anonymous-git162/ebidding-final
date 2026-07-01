---
description: Add a new page to the e-bidding app with proper routing, navigation, and role access
---

# Add Route

Add a new page to the e-bidding React app with correct routing, navigation items, and role-based access control. Follows the established 3-step pattern used across all pages in the project.

## Usage

```
/add-route <page-name> <roles>
```

## Arguments

- `$1` or `$ARGUMENTS`: Page name (e.g., `Reports`, `Notifications`, `Settings`)
- `$2`: Comma-separated roles that can access the page (e.g., `admin,procurement`)

## What It Does

Walks through the 3-step pattern for adding any new page:

### Step 1: Update ROLE_ROUTES in AppRoutes.tsx

Add the page path to each role's allowed routes array.

**File:** `frontend/src/routes/AppRoutes.tsx`

```typescript
const ROLE_ROUTES: Record<string, string[]> = {
  ADMIN: ['dashboard', 'procurements', 'users', 'vendors', 'audit', 'ebidding-rounds', 'reports'],  // ← add here
  PROCUREMENT: ['dashboard', 'procurements', 'users', 'vendors', 'audit', 'ebidding-rounds', 'reports'],
  VENDOR: ['dashboard', 'procurements', 'bidding', 'invitations', 'results', 'reports'],
  // ... other roles
};
```

**Critical rule:** If a path isn't listed for a role, `RoleGuard` silently redirects to dashboard with "You don't have permission." ALWAYS add the path to every role that should access it.

### Step 2: Update NAVIGATION_ITEMS in AppShell.tsx

Add the sidebar navigation entry.

**File:** `frontend/src/layouts/AppShell.tsx`

```typescript
const NAVIGATION_ITEMS = [
  // ... existing items
  { label: 'Reports', path: '/reports', icon: 'BarChart', roles: ['ADMIN', 'PROCUREMENT', 'APPROVER'] },
];
```

**Icon must exist in Icon.tsx.** Check available icons before adding. Unknown names silently render nothing.

### Step 3: Create the Page Component

Create the page file at `frontend/src/pages/<PageName>Page.tsx`.

Follow the established page template:

```typescript
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button,
  CircularProgress, Alert, Chip,
} from '@mui/material';
import { Icon } from '../components/Icon';
import { serviceName } from '../services/serviceName';
import { TypeName } from '../types/typeName';

export const PageNamePage: React.FC = () => {
  const [data, setData] = useState<TypeName[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => { fetchData(); }, []);

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

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box>
      {/* Page content */}
    </Box>
  );
};
```

### Step 4: Register the Route

Add the route in `AppRoutes.tsx`:

```typescript
<Route path="/reports" element={<PrivateRoute><ReportsPage /></PrivateRoute>} />
```

## Complete Example: Adding a "Reports" Page

```bash
/add-route Reports admin,procurement,approver
```

This would:
1. Add `'reports'` to ADMIN, PROCUREMENT, APPROVER route arrays in `ROLE_ROUTES`
2. Add `{ label: 'Reports', path: '/reports', icon: 'BarChart', roles: [...] }` to `NAVIGATION_ITEMS`
3. Create `frontend/src/pages/ReportsPage.tsx` with the page template
4. Add `<Route path="/reports" element={<PrivateRoute><ReportsPage /></PrivateRoute>} />` to route config

## Common Gotchas

- **RoleGuard silently redirects:** If you forget to add a path to a role's `ROLE_ROUTES`, users see "You don't have permission" with no explanation. ALWAYS check all 7 roles.
- **Icon silently returns null:** If the icon name doesn't exist in `Icon.tsx`, the sidebar shows nothing. Grep for existing icon names first.
- **Missing Chip import:** MUI `Chip` is NOT auto-imported — add it explicitly when using status chips.
- **Native select requires `SelectProps`:** `<TextField select>` with `<option>` children needs `SelectProps={{ native: true }}` or renders incorrectly.

## Checklist

- [ ] Path added to `ROLE_ROUTES` for all allowed roles
- [ ] Navigation entry added to `NAVIGATION_ITEMS` in AppShell.tsx
- [ ] Icon name exists in `Icon.tsx`
- [ ] Page component created with loading/error/empty states
- [ ] Route registered in `AppRoutes.tsx`
- [ ] TypeScript compiles with 0 errors
- [ ] Docker rebuild passes
