import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Alert, Chip, TextField, FormControl, InputLabel, Select, MenuItem, LinearProgress,
} from '@mui/material';
import { Icon } from '../components/Icon';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { TYPE_COLORS, TYPE_COLORS_BG } from '../utils/statusColors';
import { CURRENCY_MAP } from '../utils/constants';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Results' },
  { value: 'AWARD_APPROVED', label: 'Award Approved' },
  { value: 'AWARD_ANNOUNCED', label: 'Award Announced' },
  { value: 'COMPLETED', label: 'Completed' },
];

const RESULT_STATUSES = ['AWARD_APPROVED', 'AWARD_ANNOUNCED', 'COMPLETED'];

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'All Types' },
  { value: 'RFP', label: 'RFP' },
  { value: 'RFQ', label: 'RFQ' },
  { value: 'RFI', label: 'RFI' },
];

export default function ResultsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => { loadResults(); }, [user?.role]);

  const loadResults = async () => {
    try {
      let res;
      if (user?.role === 'VENDOR') {
        const invRes = await api.get('/vendor-invitations/my');
        const invitations = invRes.data || [];
        const procIds = [...new Set(invitations.filter((i: any) => i.invitationStatus === 'ACCEPTED').map((i: any) => i.procurementId))];
        if (procIds.length > 0) {
          const procRes = await api.get('/procurements', { params: { limit: 50 } });
          setItems((procRes.data.data || []).filter((p: any) => procIds.includes(p.id) && RESULT_STATUSES.includes(p.status)));
        }
      } else {
        res = await api.get('/procurements', { params: { limit: 50 } });
        setItems((res.data.data || []).filter((p: any) => RESULT_STATUSES.includes(p.status)));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && item.requestType !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const title = (item.title || '').toLowerCase();
      const requestNo = (item.requestNo || '').toLowerCase();
      if (!title.includes(q) && !requestNo.includes(q)) return false;
    }
    if (dateFrom) {
      const created = new Date(item.createdAt);
      const from = new Date(dateFrom);
      if (created < from) return false;
    }
    if (dateTo) {
      const created = new Date(item.createdAt);
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (created > to) return false;
    }
    return true;
  });

  const totalBudget = filteredItems.reduce((sum, item) => sum + Number(item.budgetEstimate || 0), 0);
  const hasFilters = searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL' || dateFrom || dateTo;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          {user?.role === 'VENDOR' ? 'My Results' : 'Procurement Results'}
        </Typography>
        <Chip label={`${filteredItems.length} result${filteredItems.length !== 1 ? 's' : ''}`} color="primary" />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: 'info.50', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="Assignment" sx={{ color: 'info.main', fontSize: 20 }} />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={700}>{filteredItems.length}</Typography>
                <Typography variant="caption" color="text.secondary">Total Results</Typography>
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
                <Typography variant="h5" fontWeight={700}>{items.filter((i) => i.status === 'COMPLETED').length}</Typography>
                <Typography variant="caption" color="text.secondary">Completed</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: 'warning.50', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="Assessment" sx={{ color: 'warning.main', fontSize: 20 }} />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={700}>${totalBudget >= 1000000 ? `${(totalBudget / 1000000).toFixed(1)}M` : totalBudget >= 1000 ? `${(totalBudget / 1000).toFixed(0)}K` : totalBudget.toLocaleString()}</Typography>
                <Typography variant="caption" color="text.secondary">Total Budget</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small" placeholder="Search by name or request no..."
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ minWidth: 250 }}
          InputProps={{
            startAdornment: <Icon name="Search" sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />,
          }}
        />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Type</InputLabel>
          <Select value={typeFilter} label="Type" onChange={(e) => setTypeFilter(e.target.value)}>
            {TYPE_OPTIONS.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField
          size="small" label="From" type="date"
          value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }} sx={{ minWidth: 130 }}
        />
        <TextField
          size="small" label="To" type="date"
          value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }} sx={{ minWidth: 130 }}
        />
        {hasFilters && (
          <Button size="small" startIcon={<Icon name="Cancel" />} onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); setTypeFilter('ALL'); setDateFrom(''); setDateTo(''); }}>
            Clear
          </Button>
        )}
      </Box>

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 600 }}>Request No</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Title</TableCell>
                <TableCell sx={{ fontWeight: 600, display: { xs: 'none', sm: 'table-cell' } }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600, display: { xs: 'none', sm: 'table-cell' } }}>Budget</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, display: { xs: 'none', sm: 'table-cell' } }}>Created</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.map((item) => {
                const typeColor = TYPE_COLORS[item.requestType] || 'text.secondary';
                return (
                  <TableRow key={item.id} hover sx={{ cursor: 'pointer' }} tabIndex={0} role="button" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/procurements/${item.id}`); } }} onClick={() => navigate(`/procurements/${item.id}`)}>
                    <TableCell sx={{ fontWeight: 600 }}>{item.requestNo}</TableCell>
                    <TableCell>{item.title}</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      <Chip label={item.requestType} size="small" sx={{ bgcolor: TYPE_COLORS_BG[item.requestType] || 'action.hover', color: typeColor, fontWeight: 600 }} />
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{item.budgetEstimate ? `${CURRENCY_MAP[item.currency]?.symbol || '$'}${Number(item.budgetEstimate).toLocaleString()} ${item.currency || 'USD'}` : '—'}</TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button size="small" startIcon={<Icon name="Visibility" />} onClick={(e) => { e.stopPropagation(); navigate(user?.role === 'VENDOR' ? `/results/${item.id}` : `/procurements/${item.id}`); }}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredItems.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Box sx={{ py: 4 }}>
                      <Icon name="CheckCircle" />
                      <Typography color="text.secondary" sx={{ mt: 1 }}>
                        {hasFilters ? 'No results match your filters' : 'No results available yet'}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
