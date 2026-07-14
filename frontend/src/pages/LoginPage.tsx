import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Box, Card, CardContent, TextField, Button, Typography, Alert, useTheme } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const theme = useTheme();

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', backgroundImage: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)` }}>
      <Card sx={{ width: 420, mx: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: 'primary.main', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
              <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 22 }}>CB</Typography>
            </Box>
            <Typography variant="h5" fontWeight={700}>Welcome Back</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Enterprise CenBidding Platform</Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
              sx={{ mb: 3 }}
              InputProps={{
                endAdornment: (
                  <Button size="small" onClick={() => setShowPassword(!showPassword)} sx={{ minWidth: 'auto', textTransform: 'none' }}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Button>
                ),
              }}
            />
            <Button fullWidth variant="contained" type="submit" size="large" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 3 }}>
            Don't have an account? <Link to="/register" style={{ color: theme.palette.primary.main }}>Register as vendor</Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
