---
description: Replace hardcoded hex colors with MUI theme tokens for dark mode support
---

# Dark Mode Fix

Replace hardcoded hex colors with MUI theme tokens across pages for dark mode compatibility. Follows the pattern proven in the 137-color, 8-page batch fix.

## Usage

```
/dark-mode-fix [file-or-directory]
```

## Arguments

- `$1` or `$ARGUMENTS`: File or directory to fix. If omitted, scans all pages in `frontend/src/pages/`.

## What It Does

Scans the target for hardcoded hex colors and replaces them with MUI theme tokens.

### Color Mapping (Canonical)

| Hardcoded | MUI Token | Usage |
|-----------|-----------|-------|
| `#1E3A8A`, `#2563EB`, `#1976d2` | `primary.main`, `primary.50` | Primary elements |
| `#16A34A` | `success.main`, `success.50` | Success states |
| `#F59E0B` | `warning.main`, `warning.50` | Warning states |
| `#DC2626` | `error.main`, `error.50` | Error states |
| `#FFFFFF` (bg) | `background.paper` | Card/dialog backgrounds |
| `#F8FAFC` | `background.default` | Page backgrounds |
| `#000000` (text) | `text.primary` | Main text |
| `rgba(0,0,0,0.5)` | `action.disabled` | Disabled text |
| `#E5E7EB` | `divider` | Borders/dividers |
| Any hardcoded border | `borderColor: 'divider'` | Consistent borders |

### KPI Card Pattern

```tsx
// Before (broken in dark mode)
<Box sx={{ bgcolor: '#EFF6FF', color: '#1E3A8A', border: '1px solid #E5E7EB' }}>

// After (works in both modes)
<Box sx={{ bgcolor: 'primary.50', color: 'primary.main', borderColor: 'divider' }}>
```

### AppBar/Sidebar Pattern

```tsx
// Before (hardcoded white — invisible in dark mode)
<AppBar sx={{ bgcolor: '#FFFFFF' }}>

// After (adapts to theme)
<AppBar sx={{ bgcolor: 'background.paper' }}>
```

### Button Hover Pattern

```tsx
// Before
<Button sx={{ '&:hover': { bgcolor: '#F3F4F6' } }}>

// After
<Button sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
```

### Status Chip Pattern

```tsx
// Before
<Chip sx={{ bgcolor: '#DCFCE7', color: '#16A34A' }} />

// After
<Chip color="success" />  // MUI handles both modes
```

## Steps

1. Read the file
2. Find all hex colors (`#xxx`, `#xxxxxx`, `rgb()`, `rgba()`)
3. Replace each with the appropriate MUI theme token
4. Ensure `useTheme` or theme imports are present if using dynamic tokens
5. Verify build passes: `npm run build 2>&1`

## Verification

After fixing, check both modes:
- Light mode: colors should be identical to before
- Dark mode: backgrounds should be dark, text should be light, no invisible elements

## Quality Checklist

- [ ] No hardcoded hex colors remain (except intentional brand colors)
- [ ] `background.paper` used for card/dialog surfaces
- [ ] `background.default` used for page backgrounds
- [ ] `divider` used for borders
- [ ] `action.hover` used for hover states
- [ ] Status chips use MUI `color` prop instead of manual colors
- [ ] Build passes with 0 errors
