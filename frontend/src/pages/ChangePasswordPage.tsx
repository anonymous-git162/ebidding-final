import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, Typography, TextField, Button, Alert, IconButton } from '@mui/material';
import { Icon } from '../components/Icon';
import api from '../services/api';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
      <Card sx={{ width: 400 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <IconButton onClick={() => navigate(-1)}>
              <Icon name="ArrowBack" />
            </IconButton>
            <Typography variant="h6" fontWeight={600}>Change Password</Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          <form onSubmit={handleSubmit}>
            <TextField fullWidth label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} sx={{ mb: 2 }} required />
            <TextField fullWidth label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} helperText="At least 6 characters" sx={{ mb: 2 }} required />
            <TextField fullWidth label="Confirm New Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} sx={{ mb: 3 }} required />
            <Button fullWidth variant="contained" type="submit" disabled={loading}>
              {loading ? 'Changing...' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
