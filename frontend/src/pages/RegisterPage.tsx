import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Box, Card, CardContent, TextField, Button, Typography, Alert, useTheme } from '@mui/material';
import api from '../services/api';

export default function RegisterPage() {
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', fullName: '', companyName: '', taxId: '', phone: '', address: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(successTimer.current), []);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const isValidPassword = (pw: string) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(pw);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!isValidEmail(form.email)) { setError('Valid email required'); return; }
    if (!isValidPassword(form.password)) { setError('Min 8 chars, uppercase, lowercase, and number'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    if (!form.companyName) { setError('Company name is required'); return; }
    if (!form.fullName) { setError('Contact name is required'); return; }

    setLoading(true);
    try {
      await api.post('/vendors/register', {
        email: form.email, password: form.password, fullName: form.fullName,
        companyName: form.companyName, taxId: form.taxId || undefined,
        phone: form.phone || undefined, address: form.address || undefined,
      });
      setSuccess('Registration submitted! An administrator will review and approve your account.');
      clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSuccess(''), 5000);
      setForm({ email: '', password: '', confirmPassword: '', fullName: '', companyName: '', taxId: '', phone: '', address: '' });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const theme = useTheme();

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', backgroundImage: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)` }}>
      <Card sx={{ maxWidth: 480, width: '100%', mx: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: 'primary.main', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
              <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 22 }}>CB</Typography>
            </Box>
            <Typography variant="h5" fontWeight={700}>Vendor Registration</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Register your company to participate in bidding</Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          {!success && (
            <form onSubmit={handleSubmit}>
              <TextField fullWidth label="Company Name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} sx={{ mb: 2 }} required />
              <TextField fullWidth label="Contact Name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} sx={{ mb: 2 }} required />
              <TextField fullWidth label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={form.email !== '' && !isValidEmail(form.email)} helperText={form.email !== '' && !isValidEmail(form.email) ? 'Enter a valid email' : ''} sx={{ mb: 2 }} required />
              <TextField fullWidth label="Tax ID (optional)" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} sx={{ mb: 2 }} />
              <TextField fullWidth label="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} sx={{ mb: 2 }} />
              <TextField fullWidth label="Address (optional)" multiline rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} sx={{ mb: 2 }} />
              <TextField fullWidth label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={form.password !== '' && !isValidPassword(form.password)} helperText={form.password !== '' && !isValidPassword(form.password) ? 'Min 8 chars, uppercase, lowercase, and number' : ''} sx={{ mb: 2 }} required />
              <TextField fullWidth label="Confirm Password" type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} error={form.confirmPassword !== '' && form.password !== form.confirmPassword} helperText={form.confirmPassword !== '' && form.password !== form.confirmPassword ? 'Passwords do not match' : ''} sx={{ mb: 3 }} required />
              <Button fullWidth variant="contained" type="submit" size="large" disabled={loading}>{loading ? 'Submitting...' : 'Register'}</Button>
            </form>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 3 }}>
            Already have an account? <Link to="/login" style={{ color: theme.palette.primary.main }}>Sign in</Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
