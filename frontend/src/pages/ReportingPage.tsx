import { Icon } from '../components/Icon';
import { useEffect, useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, LinearProgress,
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import api from '../services/api';

interface Stats {
  total: number;
  totalBudget: number;
  avgBudget: number;
  byStatus: Array<{ status: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  byMonth: Array<{ month: string; count: number; budget: number }>;
  recentActivity: Array<{ action: string; entityType: string; createdAt: string; actorRole: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6B7280', SUBMITTED: '#2563EB', UNDER_PROCUREMENT_REVIEW: '#F59E0B',
  APPROVED: '#10B981', RFP_PUBLISHED: '#2563EB', RFQ_OPEN: '#8B5CF6',
  BIDDING_OPEN: '#EC4899', UNDER_EVALUATION: '#F97316', PENDING_APPROVAL: '#F59E0B',
  COMPLETED: '#16A34A', REJECTED: '#DC2626', RETURNED_FOR_REVISION: '#EF4444',
};

const TYPE_COLORS: Record<string, string> = { RFP: '#2563EB', RFQ: '#F59E0B', RFI: '#6B7280' };

export default function ReportingPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const res = await api.get('/procurements/stats');
      setStats(res.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${val.toLocaleString()}`;
  };

  const exportCSV = () => {
    if (!stats) return;
    const rows = [['Status', 'Count']];
    stats.byStatus.forEach(s => rows.push([s.status, String(s.count)]));
    rows.push([], ['Type', 'Count']);
    stats.byType.forEach(t => rows.push([t.type, String(t.count)]));
    rows.push([], ['Category', 'Count']);
    stats.byCategory.forEach(c => rows.push([c.category, String(c.count)]));
    rows.push([], ['Month', 'Count', 'Budget']);
    stats.byMonth.forEach(m => rows.push([m.month, String(m.count), String(m.budget)]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'procurement-report.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <Box><LinearProgress sx={{ borderRadius: 1, mb: 3 }} /><Typography color="text.secondary">Loading reports...</Typography></Box>;
  }

  if (!stats) {
    return <Box><Typography color="text.secondary">Failed to load statistics</Typography></Box>;
  }

  const statusData = stats.byStatus.map(s => ({ name: s.status.replace(/_/g, ' '), value: s.count, fill: STATUS_COLORS[s.status] || '#9CA3AF' }));
  const typeData = stats.byType.map(t => ({ name: t.type, value: t.count, fill: TYPE_COLORS[t.type] || '#9CA3AF' }));
  const categoryData = stats.byCategory.sort((a, b) => b.count - a.count).slice(0, 8);
  const monthData = stats.byMonth.map(m => ({ month: m.month, procurements: m.count, budget: m.budget / 1000 }));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Reports & Analytics</Typography>
          <Typography variant="body2" color="text.secondary">Procurement performance overview</Typography>
        </Box>
        <Button variant="outlined" startIcon={<Icon name="Save" />} onClick={exportCSV}>Export CSV</Button>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
  { title: 'Total Procurements', value: stats.total, icon: 'Assignment', color: 'primary.main', bg: 'primary.50' },
    { title: 'Total Budget', value: formatCurrency(stats.totalBudget), icon: 'Assessment', color: 'success.main', bg: 'success.50' },
    { title: 'Avg Budget', value: formatCurrency(stats.avgBudget), icon: 'TrendingUp', color: 'warning.main', bg: 'warning.50' },
    { title: 'Categories', value: stats.byCategory.length, icon: 'Category', color: 'info.main', bg: 'info.50' },
        ].map((kpi) => (
          <Grid item xs={6} sm={3} key={kpi.title}>
            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={kpi.icon} />
                  </Box>
                  <Box>
                    <Typography variant="h5" fontWeight={700} color={kpi.color}>{kpi.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{kpi.title}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Monthly Trend</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthData}>
                  <defs>
                    <linearGradient id="colorProcurements" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="procurements" stroke="#2563EB" fill="url(#colorProcurements)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Budget by Month (K)</Typography>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => `$${value}K`} />
                  <Bar dataKey="budget" fill="#16A34A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>By Status</Typography>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}>
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>By Type</Typography>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={typeData} cx="50%" cy="50%" outerRadius={70} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {typeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Top Categories</Typography>
              {categoryData.map((cat) => (
                <Box key={cat.category} sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">{cat.category}</Typography>
                    <Typography variant="body2" fontWeight={600}>{cat.count}</Typography>
                  </Box>
                  <Box sx={{ height: 6, bgcolor: 'grey.100', borderRadius: 3 }}>
                    <Box sx={{ height: '100%', width: `${(cat.count / Math.max(...categoryData.map(c => c.count))) * 100}%`, bgcolor: 'info.main', borderRadius: 3, transition: 'width 0.5s' }} />
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mt: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Recent Activity</Typography>
          {stats.recentActivity.length === 0 && (
            <Typography variant="body2" color="text.secondary">No recent activity</Typography>
          )}
          {stats.recentActivity.slice(0, 10).map((item, idx) => (
            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: idx < 9 ? '1px solid #F3F4F6' : 'none' }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: 'info.50', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="Timeline" sx={{ fontSize: 16, color: 'info.main' }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2">{item.action.replace(/_/g, ' ')}</Typography>
                <Typography variant="caption" color="text.secondary">{item.entityType} | {item.actorRole || 'System'} | {new Date(item.createdAt).toLocaleString()}</Typography>
              </Box>
            </Box>
          ))}
        </CardContent>
      </Card>
    </Box>
  );
}
