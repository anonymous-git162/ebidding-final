import React from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: 2, px: 3 }}>
          <Alert severity="error" sx={{ maxWidth: 500, width: '100%' }}>
            Something went wrong. The page crashed unexpectedly.
          </Alert>
          {this.state.error && (
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', maxWidth: 500, wordBreak: 'break-all' }}>
              {this.state.error.message}
            </Typography>
          )}
          <Button variant="contained" onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
