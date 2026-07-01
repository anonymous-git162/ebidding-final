import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Button, Chip, Alert, Divider, Paper, List, ListItem, ListItemIcon, ListItemText, CircularProgress } from '@mui/material';
import { Icon } from '../components/Icon';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function ResultDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) loadResult();
  }, [id]);

  const loadResult = async () => {
    try {
      const res = await api.get(`/results/${id}`);
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load result');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  if (error) return (
    <Box sx={{ m: 3 }}>
      <Button startIcon={<Icon name="ArrowBack" />} onClick={() => navigate('/results')} sx={{ mb: 2 }}>Back to Results</Button>
      <Alert severity="info">Result is not available yet. The procurement may still be in progress.</Alert>
    </Box>
  );
  if (!result) return (
    <Box sx={{ m: 3 }}>
      <Button startIcon={<Icon name="ArrowBack" />} onClick={() => navigate('/results')} sx={{ mb: 2 }}>Back to Results</Button>
      <Alert severity="info">No result found for this procurement.</Alert>
    </Box>
  );

  const isVendor = user?.role === 'VENDOR';
  const statusLabel = result.status || 'Unknown';

  return (
    <Box>
      <Button startIcon={<Icon name="ArrowBack" />} onClick={() => navigate('/results')} sx={{ mb: 2 }}>
        Back to Results
      </Button>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {isVendor ? 'Your Result' : 'Procurement Result'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {result.procurement?.requestNo} — {result.procurement?.title}
          </Typography>
        </Box>
        <Chip
          label={statusLabel}
          color={statusLabel === 'Selected' ? 'success' : statusLabel === 'Not Selected' ? 'error' : 'default'}
          sx={{ fontWeight: 600, fontSize: '0.9rem', px: 2, py: 1 }}
        />
      </Box>

      {isVendor ? (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: statusLabel === 'Selected' ? 'success.50' : 'error.50', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={statusLabel === 'Selected' ? 'CheckCircle' : 'Cancel'} sx={{ fontSize: 32, color: statusLabel === 'Selected' ? 'success.main' : 'error.main' }} />
              </Box>
              <Box>
                <Typography variant="h4" fontWeight={700} color={statusLabel === 'Selected' ? 'success.main' : 'error.main'}>
                  {statusLabel}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {statusLabel === 'Selected'
                    ? 'Congratulations! Your proposal has been selected.'
                    : 'Thank you for your participation. Another vendor was selected.'}
                </Typography>
              </Box>
            </Box>
            {result.announcementText && (
              <Paper sx={{ p: 2, bgcolor: 'action.hover', mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Announcement</Typography>
                <Typography variant="body2">{result.announcementText}</Typography>
              </Paper>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
          <CardContent>
            <List>
              <ListItem>
                <ListItemIcon sx={{ color: 'info.main' }}><Icon name="Assignment" /></ListItemIcon>
                <ListItemText primary="Procurement" secondary={`${result.procurement?.requestNo} — ${result.procurement?.title}`} />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemIcon sx={{ color: 'primary.main' }}><Icon name="CheckCircle" /></ListItemIcon>
                <ListItemText primary="Status" secondary={result.procurement?.status} />
              </ListItem>
              <Divider />
              {result.winningVendor && (
                <>
                  <ListItem>
                    <ListItemIcon sx={{ color: 'success.main' }}><Icon name="Gavel" /></ListItemIcon>
                    <ListItemText primary="Winning Vendor" secondary={result.winningVendor.companyName} />
                  </ListItem>
                  <Divider />
                </>
              )}
              {result.announcementText && (
                <ListItem>
                  <ListItemIcon sx={{ color: 'warning.main' }}><Icon name="Send" /></ListItemIcon>
                  <ListItemText primary="Announcement" secondary={result.announcementText} />
                </ListItem>
              )}
            </List>
          </CardContent>
        </Card>
      )}

      <Button variant="outlined" startIcon={<Icon name="Dashboard" />} onClick={() => navigate('/dashboard')}>
        Back to Dashboard
      </Button>
    </Box>
  );
}
