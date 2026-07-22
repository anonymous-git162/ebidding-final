import { useEffect, useState } from 'react';
import { STATUS_COLORS } from '../utils/statusColors';
import {
  Box, Grid, Card, CardContent, Typography, LinearProgress, Chip, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from 'recharts';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import KpiCard from '../components/KpiCard';
import { CURRENCY_MAP } from '../utils/constants';

interface VendorAnalytics {
  vendor: { id: string; companyName: string };
  summary: {
    invitedCount: number;
    acceptedCount: number;
    declinedCount: number;
    pendingCount: number;
    submissionCount: number;
    totalBids: number;
    avgScore: number;
    winRate: number;
  };
  recentInvitations: Array<{ id: string; status: string; invitedAt: string; procurement: { requestNo: string; title: string; status: string } }>;
  recentSubmissions: Array<{ id: string; price: number; status: string; submittedAt: string; procurement: { requestNo: string; title: string; status: string } }>;
}

export default function VendorAnalyticsPage() {
  const fmt = (v: any) => { const n = Number(v); return isNaN(n) ? '—' : n.toLocaleString(); };
  const [analytics, setAnalytics] = useState<VendorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [myBids, setMyBids] = useState<any[]>([]);
  const [selectedBid, setSelectedBid] = useState<any>(null);
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [analyticsRes] = await Promise.all([
        api.get('/analytics/vendor'),
      ]);
      setAnalytics(analyticsRes.data);

      try {
        const invRes = await api.get('/vendor-invitations/my');
        const invitations = invRes.data || [];
        const acceptedProcs = invitations
          .filter((inv: any) => inv.status === 'ACCEPTED' && inv.procurement)
          .map((inv: any) => inv.procurement);
        const uniqueProcs = [...new Map(acceptedProcs.map((p: any) => [p.id, p])).values()];
        const completedProcs = uniqueProcs.filter((p: any) =>
          ['COMPLETED', 'AWARD_APPROVED', 'AWARD_ANNOUNCED'].includes(p.status)
        );
        setOrders(completedProcs);
      } catch { /* no orders */ }

      try {
        const bidsRes = await api.get('/ebidding/my-bids');
        const data = bidsRes.data || [];
        setMyBids(data);
      } catch { /* no bids */ }
    } catch {
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBid = async () => {
    if (!selectedBid) return;
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      setEditError('Enter a valid bid amount');
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      await api.post('/ebidding/bid', { roundId: selectedBid.round?.id, bidAmount: amount });
      setSelectedBid({ ...selectedBid, bidAmount: amount, submittedAt: new Date().toISOString() });
      setEditMode(false);
      loadData();
    } catch (err: any) {
      setEditError(err.response?.data?.message || 'Failed to update bid');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBid = async () => {
    if (!selectedBid) return;
    if (!window.confirm(`Delete your bid of $${fmt(selectedBid.bidAmount)}? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await api.delete(`/ebidding/bids/${selectedBid.id}`);
      setBidDialogOpen(false);
      setSelectedBid(null);
      loadData();
    } catch (err: any) {
      setEditError(err.response?.data?.message || 'Failed to delete bid');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Box><LinearProgress sx={{ borderRadius: 1, mb: 3 }} /><Typography color="text.secondary">Loading analytics...</Typography></Box>;
  }

  if (!analytics) {
    return <Box><Typography color="text.secondary">No vendor profile found</Typography></Box>;
  }

  const { summary } = analytics;
  const kpiCards = [
    { title: 'Invitations', value: summary.invitedCount, icon: 'Mail', color: 'info.main', bg: 'info.50' },
    { title: 'Accepted', value: summary.acceptedCount, icon: 'CheckCircle', color: 'success.main', bg: 'success.50' },
    { title: 'Submissions', value: summary.submissionCount, icon: 'Send', color: 'primary.main', bg: 'primary.50' },
    { title: 'Total Bids', value: summary.totalBids, icon: 'Gavel', color: 'warning.main', bg: 'warning.50' },
  ];

  const invitationData = [
    { name: 'Accepted', value: summary.acceptedCount, fill: STATUS_COLORS.COMPLETED },
    { name: 'Pending', value: summary.pendingCount, fill: STATUS_COLORS.PENDING_APPROVAL },
    { name: 'Declined', value: summary.declinedCount, fill: STATUS_COLORS.REJECTED },
  ].filter(d => d.value > 0);

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>Vendor Analytics</Typography>
          <Typography variant="body2" color="text.secondary">{analytics.vendor.companyName} — Performance Dashboard</Typography>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {kpiCards.map((kpi) => (
          <Grid item xs={4} sm={2} key={kpi.title}>
            <KpiCard title={kpi.title} value={kpi.value} icon={kpi.icon} color={kpi.color} bg={kpi.bg} />
          </Grid>
        ))}
      </Grid>

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Overview" />
        <Tab label={`Bid History (${myBids.length})`} />
      </Tabs>

      {activeTab === 0 && (
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Recent Submissions</Typography>
              {analytics.recentSubmissions.length === 0 && (
                <Typography variant="body2" color="text.secondary">No submissions yet</Typography>
              )}
              {analytics.recentSubmissions.map((sub, idx) => (
                <Box key={sub.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, borderBottom: idx < analytics.recentSubmissions.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>{sub.procurement?.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{sub.procurement?.requestNo} | ${sub.price.toLocaleString()} | {new Date(sub.submittedAt).toLocaleDateString()}</Typography>
                  </Box>
                  <StatusBadge status={sub.status} />
                </Box>
              ))}
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>My Bids ({myBids.length})</Typography>
              {myBids.length === 0 && (
                <Typography variant="body2" color="text.secondary">No bids placed yet</Typography>
              )}
              {myBids.map((bid: any, idx: number) => (
                <Box
                  key={bid.id}
                  onClick={() => { setSelectedBid(bid); setBidDialogOpen(true); }}
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, borderBottom: idx < myBids.length - 1 ? '1px solid' : 'none', borderColor: 'divider', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderRadius: 1, px: 1, mx: -1 }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={500}>{bid.round?.procurement?.title || 'N/A'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Round {bid.round?.roundNo} | ${fmt(bid.bidAmount)} | {new Date(bid.submittedAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Chip label={bid.round?.status || '—'} size="small" color={bid.round?.status === 'OPEN' ? 'success' : 'default'} />
                </Box>
              ))}
            </CardContent>
          </Card>

          {/* Bid Detail Dialog */}
          <Dialog open={bidDialogOpen} onClose={() => { setBidDialogOpen(false); setEditMode(false); }} maxWidth="sm" fullWidth>
            <DialogTitle>Bid Details</DialogTitle>
            <DialogContent>
              {selectedBid && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>{selectedBid.round?.procurement?.title || 'N/A'}</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Request No</Typography>
                      <Typography variant="body2" fontWeight={500}>{selectedBid.round?.procurement?.requestNo || '—'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Procurement Status</Typography>
                      <Chip label={selectedBid.round?.procurement?.status?.replace(/_/g, ' ') || '—'} size="small" sx={{ mt: 0.5 }} />
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Round</Typography>
                      <Typography variant="body2" fontWeight={500}>Round {selectedBid.round?.roundNo || '—'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Round Status</Typography>
                      <Chip label={selectedBid.round?.status || '—'} size="small" color={selectedBid.round?.status === 'OPEN' ? 'success' : 'default'} sx={{ mt: 0.5 }} />
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">My Bid Amount</Typography>
                      {editMode ? (
                        <TextField
                          size="small"
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          error={!!editError}
                          helperText={editError}
                          sx={{ mt: 0.5 }}
                          fullWidth
                          inputProps={{ min: 0 }}
                        />
                      ) : (
                        <Typography variant="body2" fontWeight={700} color="primary.main">${fmt(selectedBid.bidAmount)}</Typography>
                      )}

                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Placed At</Typography>
                      <Typography variant="body2" fontWeight={500}>{new Date(selectedBid.submittedAt).toLocaleString()}</Typography>
                    </Box>
                  </Box>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              {editMode ? (
                <>
                  <Button onClick={() => { setEditMode(false); setEditError(''); }}>Cancel</Button>
                  <Button variant="contained" onClick={handleSaveBid} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                </>
              ) : (
                <>
                  {selectedBid?.round?.status === 'OPEN' && (
                    <>
                      <Button color="error" onClick={handleDeleteBid} disabled={saving}>Delete</Button>
                      <Button variant="outlined" onClick={() => { setEditMode(true); setEditAmount(String(selectedBid.bidAmount)); }}>Edit Bid</Button>
                    </>
                  )}
                  <Button onClick={() => { setBidDialogOpen(false); setEditMode(false); }}>Close</Button>
                </>
              )}
            </DialogActions>
          </Dialog>



          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Recent Orders</Typography>
              {orders.length === 0 && (
                <Typography variant="body2" color="text.secondary">No completed orders yet</Typography>
              )}
              {orders.map((order: any, idx: number) => (
                <Box key={order.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, borderBottom: idx < orders.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>{order.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {order.requestNo} | {order.budgetEstimate ? `${CURRENCY_MAP[order.currency]?.symbol || '$'}${Number(order.budgetEstimate).toLocaleString()}` : 'N/A'} | {new Date(order.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Chip label={order.status?.replace(/_/g, ' ') || '—'} size="small" color="success" />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          {invitationData.length > 0 && (
            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Invitation Status</Typography>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={invitationData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                       {invitationData.map((entry) => (
                         <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                       ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

        </Grid>
      </Grid>
      )}

      {activeTab === 1 && (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Bid History</Typography>
            {myBids.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No bids placed yet</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Procurement</TableCell>
                      <TableCell>Request No</TableCell>
                      <TableCell align="right">Round</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Placed At</TableCell>
                      <TableCell align="center">Status</TableCell>
                      <TableCell align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {myBids.map((bid: any) => (
                      <TableRow key={bid.id} hover sx={{ cursor: 'pointer' }} tabIndex={0} role="button" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedBid(bid); setBidDialogOpen(true); } }} onClick={() => { setSelectedBid(bid); setBidDialogOpen(true); }}>
                        <TableCell sx={{ fontWeight: 500 }}>{bid.round?.procurement?.title || 'N/A'}</TableCell>
                        <TableCell>{bid.round?.procurement?.requestNo || '—'}</TableCell>
                        <TableCell align="right">Round {bid.round?.roundNo || '—'}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main' }}>${fmt(bid.bidAmount)}</TableCell>
                        <TableCell align="right">{new Date(bid.submittedAt).toLocaleString()}</TableCell>
                        <TableCell align="center">
                          <Chip label={bid.round?.status || '—'} size="small" color={bid.round?.status === 'OPEN' ? 'success' : bid.round?.status === 'CLOSED' ? 'default' : 'info'} />
                        </TableCell>
                        <TableCell align="center">
                          {bid.round?.status === 'OPEN' && (
                            <Button size="small" color="error" onClick={(e) => { e.stopPropagation(); setSelectedBid(bid); setBidDialogOpen(true); }}>Delete</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
