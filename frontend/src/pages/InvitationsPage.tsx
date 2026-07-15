import { Icon } from '../components/Icon';
import { useEffect, useState, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, FormControl, InputLabel, Alert, TextField, LinearProgress,
} from '@mui/material';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { TYPE_COLORS, TYPE_COLORS_BG } from '../utils/statusColors';

export default function InvitationsPage() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [procurementId, setProcurementId] = useState('');
  const [vendorIds, setVendorIds] = useState<string[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [procurements, setProcurements] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const successTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(successTimer.current), []);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [procurementFilter, setProcurementFilter] = useState('ALL');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      if (user?.role === 'VENDOR') {
        const res = await api.get('/vendor-invitations/my');
        setInvitations(res.data || []);
      } else {
        const [pRes, vRes, iRes] = await Promise.all([
          api.get('/procurements', { params: { limit: 50 } }),
          api.get('/vendors'),
          api.get('/vendor-invitations', { params: { limit: 100 } }),
        ]);
        setProcurements(pRes.data.data || []);
        setVendors(vRes.data.data || []);
        setInvitations(iRes.data || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    setError('');
    try {
      await api.post('/vendor-invitations', { procurementId, vendorIds });
      setDialogOpen(false);
      setSuccess('Invitations sent successfully');
      clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSuccess(''), 3000);
      setProcurementId('');
      setVendorIds([]);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to invite');
    }
  };

  const handleAccept = async (id: string) => {
    setError('');
    try {
      await api.put(`/vendor-invitations/${id}/accept`);
      setSuccess('Invitation accepted');
      clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSuccess(''), 3000);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed');
    }
  };

  const handleDecline = async (id: string) => {
    setError('');
    try {
      await api.put(`/vendor-invitations/${id}/decline`);
      setSuccess('Invitation declined');
      clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSuccess(''), 3000);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed');
    }
  };

  const pendingCount = invitations.filter((i) => i.invitationStatus === 'PENDING').length;
  const acceptedCount = invitations.filter((i) => i.invitationStatus === 'ACCEPTED').length;
  const declinedCount = invitations.filter((i) => i.invitationStatus === 'DECLINED').length;

  const filteredInvitations = invitations.filter((inv) => {
    if (statusFilter !== 'ALL' && inv.invitationStatus !== statusFilter) return false;
    if (procurementFilter !== 'ALL' && inv.procurement?.id !== procurementFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const title = (inv.procurement?.title || '').toLowerCase();
      const requestNo = (inv.procurement?.requestNo || '').toLowerCase();
      const vendor = (inv.vendor?.companyName || '').toLowerCase();
      if (!title.includes(q) && !requestNo.includes(q) && !vendor.includes(q)) return false;
    }
    if (dateFrom) {
      const invited = new Date(inv.invitedAt);
      const from = new Date(dateFrom);
      if (invited < from) return false;
    }
    if (dateTo) {
      const invited = new Date(inv.invitedAt);
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (invited > to) return false;
    }
    return true;
  });

  const uniqueProcurements = [...new Map(invitations.map((inv) => [inv.procurement?.id, inv.procurement])).values()].filter(Boolean);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACCEPTED': return 'success';
      case 'DECLINED': return 'error';
      case 'PENDING': return 'warning';
      default: return 'default';
    }
  };

  return (
    <Box>
      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          {user?.role === 'VENDOR' ? 'My Invitations' : 'Vendor Invitations'}
        </Typography>
        {user?.role === 'PROCUREMENT' && (
          <Button variant="contained" startIcon={<Icon name="Add" />} onClick={() => setDialogOpen(true)}>Invite Vendors</Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {user?.role === 'VENDOR' && invitations.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: 'warning.50', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="Mail" sx={{ color: 'warning.main', fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={700}>{pendingCount}</Typography>
                  <Typography variant="caption" color="text.secondary">Pending</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: 'success.50', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="CheckCircle" sx={{ color: 'success.main', fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={700}>{acceptedCount}</Typography>
                  <Typography variant="caption" color="text.secondary">Accepted</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: 'error.50', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="Cancel" sx={{ color: 'error.main', fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={700}>{declinedCount}</Typography>
                  <Typography variant="caption" color="text.secondary">Declined</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        {[
          { value: 'ALL', label: 'All', count: invitations.length },
          { value: 'PENDING', label: 'Pending', count: pendingCount, color: 'warning.main' },
          { value: 'ACCEPTED', label: 'Accepted', count: acceptedCount, color: 'success.main' },
          { value: 'DECLINED', label: 'Declined', count: declinedCount, color: 'error.main' },
        ].map((filter) => (
          <Chip
            key={filter.value}
            label={`${filter.label}${filter.count > 0 ? ` (${filter.count})` : ''}`}
            onClick={() => setStatusFilter(filter.value)}
            variant={statusFilter === filter.value ? 'filled' : 'outlined'}
            sx={{
              borderColor: filter.color || 'grey.600',
              color: statusFilter === filter.value ? 'white' : filter.color || 'grey.600',
              bgcolor: statusFilter === filter.value ? (filter.color || 'grey.600') : 'transparent',
              fontWeight: 500,
              '&:hover': { bgcolor: statusFilter === filter.value ? (filter.color || 'grey.600') : 'action.hover' },
            }}
          />
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small" placeholder="Search by name, request no, or vendor..."
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ minWidth: 280 }}
          InputProps={{
            startAdornment: <Icon name="Search" sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />,
          }}
        />
        <TextField
          size="small" label="Date From" type="date"
          value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }}
        />
        <TextField
          size="small" label="Date To" type="date"
          value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Procurement</InputLabel>
          <Select value={procurementFilter} label="Procurement" onChange={(e) => setProcurementFilter(e.target.value)}>
            <MenuItem value="ALL">All Procurements</MenuItem>
            {uniqueProcurements.map((p: any) => (
              <MenuItem key={p.id} value={p.id}>{p.requestNo} - {p.title}</MenuItem>
            ))}
          </Select>
        </FormControl>
        {(statusFilter !== 'ALL' || searchQuery || dateFrom || dateTo || procurementFilter !== 'ALL') && (
          <Button size="small" startIcon={<Icon name="Cancel" />} onClick={() => { setStatusFilter('ALL'); setSearchQuery(''); setDateFrom(''); setDateTo(''); setProcurementFilter('ALL'); }}>
            Clear Filters
          </Button>
        )}
        <Chip label={`${filteredInvitations.length} result${filteredInvitations.length !== 1 ? 's' : ''}`} size="small" color="primary" />
      </Box>

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 600 }}>Procurement</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Request No</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                {user?.role !== 'VENDOR' && <TableCell sx={{ fontWeight: 600 }}>Vendor</TableCell>}
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Invited At</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Deadline</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredInvitations.map((inv) => {
                const typeColor = TYPE_COLORS[inv.procurement?.requestType] || 'text.secondary';
                return (
                  <TableRow key={inv.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{inv.procurement?.title || '-'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={inv.procurement?.requestNo || '-'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip label={inv.procurement?.requestType || '-'} size="small" sx={{ bgcolor: TYPE_COLORS_BG[inv.procurement?.requestType] || 'action.hover', color: typeColor, fontWeight: 600 }} />
                    </TableCell>
                    {user?.role !== 'VENDOR' && (
                      <TableCell>
                        <Typography variant="body2">{inv.vendor?.companyName || '-'}</Typography>
                      </TableCell>
                    )}
                    <TableCell>
                      <Chip label={inv.invitationStatus} size="small" color={getStatusColor(inv.invitationStatus) as any} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{new Date(inv.invitedAt).toLocaleDateString()}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {(inv.deadline || inv.procurement?.submissionDeadline) ? new Date(inv.deadline || inv.procurement?.submissionDeadline).toLocaleDateString() : 'Not set'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {user?.role === 'VENDOR' && inv.invitationStatus === 'PENDING' && (
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Button size="small" variant="contained" color="success" startIcon={<Icon name="CheckCircle" />} onClick={() => handleAccept(inv.id)}>
                            Accept
                          </Button>
                          <Button size="small" variant="outlined" color="error" startIcon={<Icon name="Cancel" />} onClick={() => handleDecline(inv.id)}>
                            Decline
                          </Button>
                        </Box>
                      )}
                      {inv.invitationStatus === 'ACCEPTED' && (
                        <Chip label="Accepted" size="small" color="success" variant="outlined" />
                      )}
                      {inv.invitationStatus === 'DECLINED' && (
                        <Chip label="Declined" size="small" color="error" variant="outlined" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredInvitations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={user?.role === 'VENDOR' ? 7 : 8} align="center">
                    <Box sx={{ py: 4 }}>
                      <Icon name="Mail" />
                      <Typography color="text.secondary" sx={{ mt: 1 }}>No invitations yet</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Invite Vendors</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
            <InputLabel>Procurement</InputLabel>
            <Select value={procurementId} label="Procurement" onChange={(e) => setProcurementId(e.target.value)}>
              {procurements.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label={p.requestType} size="small" sx={{ minWidth: 40, fontSize: 10 }} />
                    {p.requestNo} - {p.title}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Vendors</InputLabel>
            <Select multiple value={vendorIds} label="Vendors" onChange={(e) => setVendorIds(e.target.value as string[])}>
              {vendors.map((v) => (
                <MenuItem key={v.id} value={v.id}>{v.companyName}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleInvite} disabled={!procurementId || vendorIds.length === 0}>Send Invitations</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
