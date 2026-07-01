import { Icon } from '../components/Icon';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, MenuItem, Select, FormControl, InputLabel, TablePagination,
  InputAdornment, Chip, IconButton, Tooltip, LinearProgress, Collapse, TableSortLabel,
} from '@mui/material';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import StatusBadge from '../components/StatusBadge';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft', color: '#6B7280' },
  { value: 'SUBMITTED', label: 'Submitted', color: '#2563EB' },
  { value: 'UNDER_PROCUREMENT_REVIEW', label: 'Under Review', color: '#F59E0B' },
  { value: 'RETURNED_FOR_REVISION', label: 'Returned', color: '#EF4444' },
  { value: 'APPROVED', label: 'Approved', color: '#10B981' },
  { value: 'RFP_PUBLISHED', label: 'RFP Published', color: '#2563EB' },
  { value: 'RFQ_OPEN', label: 'RFQ Open', color: '#8B5CF6' },
  { value: 'BIDDING_OPEN', label: 'Bidding Open', color: '#EC4899' },
  { value: 'UNDER_EVALUATION', label: 'Under Eval', color: '#F97316' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval', color: '#F59E0B' },
  { value: 'COMPLETED', label: 'Completed', color: '#16A34A' },
  { value: 'REJECTED', label: 'Rejected', color: '#DC2626' },
];

const TYPE_OPTIONS = [
  { value: 'RFP', label: 'RFP', color: '#2563EB' },
  { value: 'RFQ', label: 'RFQ', color: '#F59E0B' },
  { value: 'RFI', label: 'RFI', color: '#6B7280' },
];

const SORT_COLUMNS = [
  { value: 'createdAt', label: 'Date' },
  { value: 'title', label: 'Title' },
  { value: 'requestNo', label: 'Request No' },
  { value: 'status', label: 'Status' },
  { value: 'budgetEstimate', label: 'Budget' },
];

interface Filters {
  search: string;
  status: string;
  requestType: string;
  currency: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  dateFrom: string;
  dateTo: string;
  budgetMin: string;
  budgetMax: string;
  page: number;
  rowsPerPage: number;
}

const defaultFilters: Filters = {
  search: '', status: '', requestType: '', currency: '',
  sortBy: 'createdAt', sortOrder: 'desc',
  dateFrom: '', dateTo: '', budgetMin: '', budgetMax: '',
  page: 0, rowsPerPage: 10,
};

function readFiltersFromURL(sp: URLSearchParams): Filters {
  return {
    search: sp.get('q') || '',
    status: sp.get('status') || '',
    requestType: sp.get('type') || '',
    currency: sp.get('currency') || '',
    sortBy: sp.get('sort') || 'createdAt',
    sortOrder: (sp.get('order') as 'asc' | 'desc') || 'desc',
    dateFrom: sp.get('from') || '',
    dateTo: sp.get('to') || '',
    budgetMin: sp.get('bmin') || '',
    budgetMax: sp.get('bmax') || '',
    page: parseInt(sp.get('page') || '0'),
    rowsPerPage: parseInt(sp.get('limit') || '10'),
  };
}

function writeFiltersToURL(f: Filters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.search) sp.set('q', f.search);
  if (f.status) sp.set('status', f.status);
  if (f.requestType) sp.set('type', f.requestType);
  if (f.currency) sp.set('currency', f.currency);
  if (f.sortBy !== 'createdAt') sp.set('sort', f.sortBy);
  if (f.sortOrder !== 'desc') sp.set('order', f.sortOrder);
  if (f.dateFrom) sp.set('from', f.dateFrom);
  if (f.dateTo) sp.set('to', f.dateTo);
  if (f.budgetMin) sp.set('bmin', f.budgetMin);
  if (f.budgetMax) sp.set('bmax', f.budgetMax);
  if (f.page > 0) sp.set('page', String(f.page));
  if (f.rowsPerPage !== 10) sp.set('limit', String(f.rowsPerPage));
  return sp;
}

export default function ProcurementListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => readFiltersFromURL(searchParams));
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [currencyOptions, setCurrencyOptions] = useState<{ currency: string; count: number }[]>([]);
  const searchTimer = useRef<any>(null);

  const updateFilter = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch, ...(patch.search !== undefined || patch.status !== undefined || patch.requestType !== undefined ? { page: 0 } : {}) };
      return next;
    });
  }, []);

  useEffect(() => {
    const sp = writeFiltersToURL(filters);
    setSearchParams(sp, { replace: true });
  }, [filters, setSearchParams]);

  useEffect(() => {
    const timer = setTimeout(() => loadItems(), 50);
    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    api.get('/procurements/currencies').then((res) => setCurrencyOptions(res.data || [])).catch(() => {});
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: filters.page + 1,
        limit: filters.rowsPerPage,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      };
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.requestType) params.requestType = filters.requestType;
      if (filters.currency) params.currency = filters.currency;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.budgetMin) params.budgetMin = parseFloat(filters.budgetMin);
      if (filters.budgetMax) params.budgetMax = parseFloat(filters.budgetMax);

      const res = await api.get('/procurements', { params });
      setItems(res.data.data || []);
      setTotal(res.data.meta?.total || 0);
      setStatusCounts(res.data.meta?.statusCounts || {});
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => updateFilter({ search: value }), 400);
  };

  const clearAllFilters = () => {
    setFilters(defaultFilters);
    setAdvancedOpen(false);
  };

  const exportCSV = async () => {
    try {
      const params: any = { limit: 500 };
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.requestType) params.requestType = filters.requestType;
      if (filters.currency) params.currency = filters.currency;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.budgetMin) params.budgetMin = parseFloat(filters.budgetMin);
      if (filters.budgetMax) params.budgetMax = parseFloat(filters.budgetMax);

      const res = await api.get('/procurements', { params });
      const items = res.data.data || [];
      if (items.length === 0) return;

      const headers = ['Request No', 'Title', 'Type', 'Status', 'Category', 'Currency', 'Budget', 'Created'];
      const rows = items.map((p: any) => [
        p.requestNo,
        `"${(p.title || '').replace(/"/g, '""')}"`,
        p.requestType,
        p.status,
        p.category || '',
        p.currency || 'USD',
        p.budgetEstimate || '',
        new Date(p.createdAt).toLocaleDateString(),
      ]);

      const csv = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `procurements-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
    }
  };

  const activeCount = [
    filters.search ? 1 : 0,
    filters.status ? 1 : 0,
    filters.requestType ? 1 : 0,
    filters.currency ? 1 : 0,
    filters.dateFrom || filters.dateTo ? 1 : 0,
    filters.budgetMin || filters.budgetMax ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const handleSort = (col: string) => {
    const isAsc = filters.sortBy === col && filters.sortOrder === 'asc';
    updateFilter({ sortBy: col, sortOrder: isAsc ? 'desc' : 'asc' });
  };

  const formatCurrency = (val: number, currency?: string) => {
    const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'THB' ? '฿' : currency === 'JPY' || currency === 'CNY' ? '¥' : '$';
    const code = currency || 'USD';
    if (val >= 1000000) return `${sym}${(val / 1000000).toFixed(1)}M ${code}`;
    if (val >= 1000) return `${sym}${(val / 1000).toFixed(0)}K ${code}`;
    return `${sym}${val.toLocaleString()} ${code}`;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Procurements</Typography>
          <Typography variant="body2" color="text.secondary">
            {loading ? 'Loading...' : `${total} result${total !== 1 ? 's' : ''}`}
            {activeCount > 0 && ` (filtered from all)`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<Icon name="Download" />} onClick={exportCSV} disabled={loading || total === 0} sx={{ px: 2 }}>
            Export CSV
          </Button>
          {(user?.role === 'REQUESTER' || user?.role === 'PROCUREMENT' || user?.role === 'ADMIN') && (
            <Button variant="contained" startIcon={<Icon name="Add" />} onClick={() => navigate('/procurements/new')} sx={{ px: 3 }}>
              New Request
            </Button>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 0.75, mb: 2, flexWrap: 'wrap' }}>
        {STATUS_OPTIONS.map((status) => {
          const count = statusCounts[status.value] || 0;
          const active = filters.status === status.value;
          return (
            <Chip
              key={status.value}
              label={`${status.label}${count > 0 ? ` (${count})` : ''}`}
              size="small"
              onClick={() => updateFilter({ status: active ? '' : status.value })}
              variant={active ? 'filled' : 'outlined'}
              sx={{
                borderColor: status.color,
                color: active ? 'white' : status.color,
                bgcolor: active ? status.color : 'transparent',
                '&:hover': { bgcolor: active ? status.color : `${status.color}15` },
                fontWeight: 500, fontSize: 12,
              }}
            />
          );
        })}
      </Box>

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 2 }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small" placeholder="Search title, request no, description..."
              defaultValue={filters.search}
              onChange={(e) => handleSearch(e.target.value)}
              sx={{ flex: 1, minWidth: 280 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Icon name="Search" /></InputAdornment>,
                endAdornment: filters.search && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => updateFilter({ search: '' })}><Icon name="Cancel" /></IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Type</InputLabel>
              <Select value={filters.requestType} label="Type" onChange={(e) => updateFilter({ requestType: e.target.value })}>
                <MenuItem value="">All Types</MenuItem>
                {TYPE_OPTIONS.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Currency</InputLabel>
              <Select value={filters.currency} label="Currency" onChange={(e) => updateFilter({ currency: e.target.value })}>
                <MenuItem value="">All</MenuItem>
                {currencyOptions.map((c) => <MenuItem key={c.currency} value={c.currency}>{c.currency}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Sort By</InputLabel>
              <Select value={filters.sortBy} label="Sort By" onChange={(e) => updateFilter({ sortBy: e.target.value })}>
                {SORT_COLUMNS.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
              </Select>
            </FormControl>
            <Tooltip title={filters.sortOrder === 'desc' ? 'Descending (newest first)' : 'Ascending (oldest first)'}>
              <IconButton size="small" onClick={() => updateFilter({ sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc' })}>
                <Icon name={filters.sortOrder === 'desc' ? 'ArrowBack' : 'ArrowForward'} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Advanced filters">
              <IconButton size="small" onClick={() => setAdvancedOpen(!advancedOpen)} sx={{ color: advancedOpen ? 'primary.main' : 'text.secondary' }}>
                <Icon name="Edit" />
              </IconButton>
            </Tooltip>
            {activeCount > 0 && (
              <Chip label={`${activeCount} filter${activeCount > 1 ? 's' : ''}`} size="small" color="primary" onDelete={clearAllFilters} />
            )}
          </Box>

          <Collapse in={advancedOpen}>
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #F3F4F6', display: 'flex', gap: 1.5, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <TextField
                size="small" label="Date From" type="date"
                value={filters.dateFrom} onChange={(e) => updateFilter({ dateFrom: e.target.value })}
                InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }}
              />
              <TextField
                size="small" label="Date To" type="date"
                value={filters.dateTo} onChange={(e) => updateFilter({ dateTo: e.target.value })}
                InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }}
              />
              <TextField
                size="small" label="Budget Min ($)" type="number"
                value={filters.budgetMin} onChange={(e) => updateFilter({ budgetMin: e.target.value })}
                sx={{ minWidth: 130 }}
              />
              <TextField
                size="small" label="Budget Max ($)" type="number"
                value={filters.budgetMax} onChange={(e) => updateFilter({ budgetMax: e.target.value })}
                sx={{ minWidth: 130 }}
              />
              {activeCount > 0 && (
                <Button size="small" startIcon={<Icon name="Cancel" />} onClick={clearAllFilters} sx={{ textTransform: 'none' }}>
                  Clear All
                </Button>
              )}
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {loading && <LinearProgress sx={{ borderRadius: 1, mb: 1 }} />}

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                {[
                  { key: 'requestNo', label: 'Request', width: 160 },
                  { key: 'title', label: 'Title' },
                  { key: 'requestType', label: 'Type', width: 100 },
                  { key: 'property', label: 'Property', width: 140 },
                  { key: 'status', label: 'Status', width: 150 },
                  { key: 'budgetEstimate', label: 'Budget', width: 110, align: 'right' as const },
                  { key: 'createdAt', label: 'Date', width: 100 },
                ].map((col) => (
                  <TableCell key={col.key} sx={{ fontWeight: 600, color: 'text.secondary', width: col.width, textAlign: col.align }}>
                    {SORT_COLUMNS.find((s) => s.value === col.key) ? (
                      <TableSortLabel
                        active={filters.sortBy === col.key}
                        direction={filters.sortBy === col.key ? filters.sortOrder : 'desc'}
                        onClick={() => handleSort(col.key)}
                      >
                        {col.label}
                      </TableSortLabel>
                    ) : col.label}
                  </TableCell>
                ))}
                <TableCell sx={{ width: 40 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <Box sx={{ opacity: 0.5 }}><Icon name="Assignment" /></Box>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1, mb: 0.5 }}>No procurements found</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {activeCount > 0 ? 'Try adjusting your filters or search terms' : 'Get started by creating your first procurement request'}
                    </Typography>
                    {activeCount > 0 ? (
                      <Button variant="outlined" onClick={clearAllFilters}>Clear All Filters</Button>
                    ) : (
                      <Button variant="contained" startIcon={<Icon name="Add" />} onClick={() => navigate('/procurements/new')}>Create Request</Button>
                    )}
                  </TableCell>
                </TableRow>
              )}
              {items.map((item) => (
                <TableRow
                  key={item.id} hover sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }}
                  onClick={() => navigate(`/procurements/${item.id}`)}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        width: 32, height: 32, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: item.requestType === 'RFP' ? 'primary.50' : item.requestType === 'RFQ' ? 'warning.50' : 'action.hover',
                      }}>
                        <Typography variant="caption" fontWeight={700} color={item.requestType === 'RFP' ? 'primary.main' : item.requestType === 'RFQ' ? 'warning.main' : 'text.secondary'}>
                          {item.requestType}
                        </Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={500} noWrap>{item.requestNo}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 280 }}>{item.title}</Typography>
                    {item.category && <Typography variant="caption" color="text.secondary">{item.category}</Typography>}
                  </TableCell>
                  <TableCell><Chip label={item.requestType} size="small" variant="outlined" sx={{ fontWeight: 500 }} /></TableCell>
                  <TableCell><Typography variant="body2" color="text.secondary">{item.property?.name || 'General'}</Typography></TableCell>
                  <TableCell><StatusBadge status={item.status} /></TableCell>
                  <TableCell sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" fontWeight={500}>
                      {item.budgetEstimate ? formatCurrency(Number(item.budgetEstimate), item.currency) : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View details">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigate(`/procurements/${item.id}`); }}>
                        <Icon name="ArrowForward" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div" count={total} page={filters.page} rowsPerPage={filters.rowsPerPage}
          onPageChange={(_, p) => updateFilter({ page: p })}
          onRowsPerPageChange={(e) => updateFilter({ rowsPerPage: parseInt(e.target.value), page: 0 })}
          rowsPerPageOptions={[5, 10, 25, 50]}
          sx={{ borderTop: '1px solid #E5E7EB' }}
        />
      </Card>
    </Box>
  );
}
