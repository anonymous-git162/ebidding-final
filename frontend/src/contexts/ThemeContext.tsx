import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';

interface ThemeContextType {
  mode: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ mode: 'light', toggleTheme: () => {} });

export const useThemeMode = () => useContext(ThemeContext);

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1E3A8A', light: '#2563EB', dark: '#1E3A8A' },
    secondary: { main: '#2563EB' },
    success: { main: '#16A34A' },
    warning: { main: '#F59E0B' },
    error: { main: '#DC2626' },
    background: { default: '#F8FAFC', paper: '#FFFFFF' },
  },
  typography: { fontFamily: 'Inter, Roboto, sans-serif', h5: { fontWeight: 600 }, h6: { fontWeight: 600 } },
  shape: { borderRadius: 8 },
  components: {
    MuiCard: { styleOverrides: { root: { boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderRadius: 8 } } },
    MuiButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
  },
});

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#3B82F6', light: '#60A5FA', dark: '#2563EB' },
    secondary: { main: '#60A5FA' },
    success: { main: '#22C55E' },
    warning: { main: '#FBBF24' },
    error: { main: '#EF4444' },
    background: { default: '#0F172A', paper: '#1E293B' },
  },
  typography: { fontFamily: 'Inter, Roboto, sans-serif', h5: { fontWeight: 600 }, h6: { fontWeight: 600 } },
  shape: { borderRadius: 8 },
  components: {
    MuiCard: { styleOverrides: { root: { boxShadow: '0 1px 3px rgba(0,0,0,0.3)', borderRadius: 8 } } },
    MuiButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
  },
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => { localStorage.setItem('theme', mode); }, [mode]);

  const toggleTheme = () => setMode((prev) => (prev === 'light' ? 'dark' : 'light'));

  const theme = useMemo(() => (mode === 'dark' ? darkTheme : lightTheme), [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MuiThemeProvider theme={theme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
