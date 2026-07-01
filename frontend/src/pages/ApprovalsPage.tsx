import { Icon } from '../components/Icon';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, LinearProgress,
} from '@mui/material';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import StatusBadge from '../components/StatusBadge';

export default function ApprovalsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [dialog, setDialog] = useState<{ open: boolean; action: string; id: string }>({ open: false, action: '', id: '' });
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      if (user?.role === 'APPROVER' || user?.role === 'ADMIN') {
        const res = await api.get('/approval/inbox');
        setItems(res.data || []);
      } else {
        const res = await api.get('/procurements', { params: { status: 'PENDING_APPROVAL', limit: 50 } });
        setItems(res.data.data || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    setError('');
    try {
      await api.post(`/approval/${dialog.id}/${dialog.action}`, { comment: dialog.action === 'approve' ? comment : undefined, reason: dialog.action !== 'approve' ? comment : undefined });
      setDialog({ open: false, action: '', id: '' });
      setComment('');
      setSuccess(`${dialog.action.charAt(0).toUpperCase() + dialog.action.slice(1)} successful`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed');
    }
  };

  const isApprover = user?.role === 'APPROVER' || user?.role === 'ADMIN';

  return (
    <Box>
      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          {isApprover ? 'Approval Inbox' : 'Pending Approvals'}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 600 }}>Request No</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Title</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Requester</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Budget</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                {isApprover && <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => {
                const typeColor = item.requestType === 'RFP' ? 'primary.main' : item.requestType === 'RFQ' ? 'warning.main' : 'text.secondary';
                return (
                  <TableRow key={item.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/procurements/${item.id}`)}>
                    <TableCell sx={{ fontWeight: 600 }}>{item.requestNo}</TableCell>
                    <TableCell>{item.title}</TableCell>
                    <TableCell>
                      <Chip label={item.requestType} size="small" sx={{ bgcolor: `${typeColor}15`, color: typeColor, fontWeight: 600 }} />
                    </TableCell>
                    <TableCell>{item.requester?.fullName || '-'}</TableCell>
                    <TableCell>{item.budgetEstimate ? `$${Number(item.budgetEstimate).toLocaleString()}` : '—'}</TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    <TableCell>{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                    {isApprover && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button size="small" color="success" startIcon={<Icon name="CheckCircle" />} onClick={() => setDialog({ open: true, action: 'approve', id: item.id })}>Approve</Button>
                        <Button size="small" color="warning" startIcon={<Icon name="Undo" />} onClick={() => setDialog({ open: true, action: 'return', id: item.id })}>Return</Button>
                        <Button size="small" color="error" startIcon={<Icon name="Cancel" />} onClick={() => setDialog({ open: true, action: 'reject', id: item.id })}>Reject</Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={isApprover ? 8 : 7} align="center">
                  <Box sx={{ py: 4 }}>
                    <Icon name="Approval" />
                    <Typography color="text.secondary" sx={{ mt: 1 }}>No pending approvals</Typography>
                  </Box>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, action: '', id: '' })}>
        <DialogTitle>{dialog.action.charAt(0).toUpperCase() + dialog.action.slice(1)}</DialogTitle>
        <DialogContent>
          <TextField fullWidth multiline rows={3} label={dialog.action === 'approve' ? 'Comment (optional)' : 'Reason'} value={comment} onChange={(e) => setComment(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog({ open: false, action: '', id: '' })}>Cancel</Button>
          <Button variant="contained" onClick={handleAction}>Confirm</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
