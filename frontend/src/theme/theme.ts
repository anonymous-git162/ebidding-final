import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1E3A8A',
      light: '#2563EB',
      dark: '#1E3A8A',
    },
    secondary: {
      main: '#2563EB',
    },
    success: { main: '#16A34A' },
    warning: { main: '#F59E0B' },
    error: { main: '#DC2626' },
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },
  },
  typography: {
    fontFamily: 'Inter, Roboto, sans-serif',
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          borderRadius: 8,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
  },
});

export default theme;
