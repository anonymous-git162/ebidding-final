import { Icon } from '../components/Icon';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, LinearProgress, Checkbox,
} from '@mui/material';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { TYPE_COLORS } from '../utils/statusColors';
import { CURRENCY_MAP } from '../utils/constants';

const ESCALATION_COLORS: Record<string, string> = {
  CRITICAL: 'error.main', WARNING: 'warning.dark', OVERDUE: 'warning.main', NORMAL: 'text.secondary',
};

export default function ApprovalsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ open: boolean; action: string; id: string }>({ open: false, action: '', id: '' });
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [user]);

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

  const handleBulkAction = async (action: string) => {
    setError('');
    setSuccess('');
    const results = await Promise.allSettled(
      Array.from(selected).map(id => api.post(`/approval/${id}/${action}`, {})),
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    setSelected(new Set());
    if (succeeded > 0) setSuccess(`${action.charAt(0).toUpperCase() + action.slice(1)}d ${succeeded} item(s)`);
    if (failed > 0) setError(`${failed} item(s) failed`);
    load();
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isApprover = user?.role === 'APPROVER' || user?.role === 'ADMIN';

  return (
    <Box>
      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          {isApprover ? 'Approval Inbox' : 'Pending Approvals'}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {selected.size > 0 && isApprover && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">{selected.size} selected</Typography>
          <Button size="small" color="success" variant="contained" onClick={() => handleBulkAction('approve')}>Approve All</Button>
        </Box>
      )}

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                {isApprover && <TableCell sx={{ width: 40 }}><Checkbox checked={items.length > 0 && selected.size === items.length} indeterminate={selected.size > 0 && selected.size < items.length} onChange={() => { if (selected.size === items.length) setSelected(new Set()); else setSelected(new Set(items.map(i => i.id))); }} /></TableCell>}
                <TableCell sx={{ fontWeight: 600 }}>Request No</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Title</TableCell>
                <TableCell sx={{ fontWeight: 600, display: { xs: 'none', sm: 'table-cell' } }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600, display: { xs: 'none', md: 'table-cell' } }}>Requester</TableCell>
                <TableCell sx={{ fontWeight: 600, display: { xs: 'none', sm: 'table-cell' } }}>Budget</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                {isApprover && <TableCell sx={{ fontWeight: 600 }}>Pending</TableCell>}
                <TableCell sx={{ fontWeight: 600, display: { xs: 'none', sm: 'table-cell' } }}>Created</TableCell>
                {isApprover && <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => {
                const typeColor = TYPE_COLORS[item.requestType] || 'text.secondary';
                const acted = (item.approvals || []).some((a: any) => a.approverId === user?.id);
                return (
                  <TableRow key={item.id} hover sx={{ cursor: 'pointer', opacity: acted ? 0.6 : 1, textDecoration: acted ? 'line-through' : 'none' }} tabIndex={0} role="button" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/procurements/${item.id}`); } }} onClick={() => navigate(`/procurements/${item.id}`)}>
                    {isApprover && <TableCell sx={{ width: 40 }} onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} disabled={acted} /></TableCell>}
                    <TableCell sx={{ fontWeight: 600 }}>{item.requestNo}</TableCell>
                    <TableCell>{item.title}</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      <Chip label={item.requestType} size="small" sx={{ bgcolor: 'action.hover', color: typeColor, fontWeight: 600 }} />
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{item.requester?.fullName || '-'}</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{item.budgetEstimate ? `${CURRENCY_MAP[item.currency]?.symbol || '$'}${Number(item.budgetEstimate).toLocaleString()}` : '—'}</TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    {isApprover && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {item.escalationLevel && item.hoursPending !== undefined ? (
                          <Typography variant="caption" sx={{ color: ESCALATION_COLORS[item.escalationLevel] || 'text.secondary', fontWeight: item.escalationLevel !== 'NORMAL' ? 700 : 400, whiteSpace: 'nowrap' }}>
                            {item.hoursPending}h
                          </Typography>
                        ) : '—'}
                      </TableCell>
                    )}
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                    {isApprover && (
                      <TableCell onClick={(e) => e.stopPropagation()} sx={{ whiteSpace: 'nowrap' }}>
                        {acted
                          ? <Chip label="Done" color="default" size="small" />
                          : <>
                              <Button size="small" color="success" startIcon={<Icon name="CheckCircle" />} onClick={() => setDialog({ open: true, action: 'approve', id: item.id })}>Approve</Button>
                              <Button size="small" color="warning" startIcon={<Icon name="Undo" />} onClick={() => setDialog({ open: true, action: 'return', id: item.id })}>Return</Button>
                              <Button size="small" color="error" startIcon={<Icon name="Cancel" />} onClick={() => setDialog({ open: true, action: 'reject', id: item.id })}>Reject</Button>
                            </>
                        }
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={isApprover ? 10 : 7} align="center">
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
