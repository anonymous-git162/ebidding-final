---
description: Apply MUI v9 migration fixes to React components
---

# MUI v9 Fix

Apply MUI v9 migration fixes to React components.

## Usage

```
/fix-mui-v9 [file-or-directory]
```

## What It Does

Scans the specified file or directory for MUI v9 API changes and applies fixes:

1. **Grid `item` prop** → `size` prop
2. **Typography direct props** → `sx` prop
3. **TextField `InputProps`** → `slotProps`
4. **Date input `InputLabelProps`** → `slotProps.inputLabel`
5. **StepLabel `StepIconComponent`** → `slotProps.stepIcon`

## Examples

```bash
# Fix a single file
/fix-mui-v9 src/pages/DashboardPage.tsx

# Fix all files in a directory
/fix-mui-v9 src/pages/

# Fix entire frontend
/fix-mui-v9 src/
```

## Migration Rules

### Grid
```tsx
// Before (MUI v5)
<Grid item xs={12} md={6}>

// After (MUI v9)
<Grid size={{ xs: 12, md: 6 }}>
```

### Typography
```tsx
// Before (MUI v5)
<Typography fontWeight="bold" fontStyle="italic">

// After (MUI v9)
<Typography sx={{ fontWeight: 'bold', fontStyle: 'italic' }}>
```

### TextField
```tsx
// Before (MUI v5)
<TextField InputProps={{ startAdornment: <Icon name="Search" /> }} />

// After (MUI v9)
<TextField slotProps={{ input: { startAdornment: <Icon name="Search" /> } }} />
```

### Date Inputs
```tsx
// Before (MUI v5)
<TextField
  type="date"
  InputLabelProps={{ shrink: true }}
/>

// After (MUI v9)
<TextField
  type="date"
  slotProps={{ inputLabel: { shrink: true } }}
/>
```

### StepLabel
```tsx
// Before (MUI v5)
<StepLabel StepIconComponent={() => <Box>...</Box>}>

// After (MUI v9)
<StepLabel slotProps={{ stepIcon: { component: () => <Box>...</Box> } }}>
```

## Notes

- This command is for MUI v9 migration only
- For MUI v5 projects, do NOT apply these changes
- Always verify build passes after applying fixes