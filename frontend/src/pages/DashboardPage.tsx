import { Icon } from '../components/Icon';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Card, CardContent, Typography, Button, List, ListItem, ListItemText,
  Divider, Chip, LinearProgress, Avatar, Paper, Alert, useTheme,
} from '@mui/material';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import StatusBadge from '../components/StatusBadge';

interface DashboardStats {
  total: number;
  pending: number;
  active: number;
  completed: number;
  rejected: number;
  drafts: number;
}

interface RecentActivity {
  id: string;
  action: string;
  procurement: string;
  requestNo: string;
  timestamp: string;
  role: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const [stats, setStats] = useState<DashboardStats>({ total: 0, pending: 0, active: 0, completed: 0, rejected: 0, drafts: 0 });
  const [recentItems, setRecentItems] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [vendorAnalytics, setVendorAnalytics] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const res = await api.get('/procurements', { params: { limit: 50 } });
      const items = res.data.data || [];
      setRecentItems(items.slice(0, 5));
      setStats({
        total: res.data.meta?.total || items.length,
        drafts: items.filter((i: any) => i.status === 'DRAFT').length,
        pending: items.filter((i: any) => ['SUBMITTED', 'UNDER_PROCUREMENT_REVIEW', 'PENDING_APPROVAL', 'RETURNED_FOR_REVISION'].includes(i.status)).length,
        active: items.filter((i: any) => ['RFP_PUBLISHED', 'RFQ_OPEN', 'BIDDING_OPEN', 'UNDER_EVALUATION', 'VENDOR_RESPONSE_IN_PROGRESS'].includes(i.status)).length,
        completed: items.filter((i: any) => i.status === 'COMPLETED').length,
        rejected: items.filter((i: any) => i.status === 'REJECTED').length,
      });

      if (user?.role === 'APPROVER') {
        const approvalRes = await api.get('/approval/inbox');
        setApprovals(approvalRes.data || []);
      }
      if (user?.role === 'VENDOR') {
        const invRes = await api.get('/vendor-invitations/my');
        setInvitations(invRes.data || []);
        try {
          const analyticsRes = await api.get('/analytics/vendor');
          setVendorAnalytics(analyticsRes.data);
        } catch { /* analytics not available */ }
      }

      // Generate recent activity from items
      const activity: RecentActivity[] = items.slice(0, 8).map((item: any) => ({
        id: item.id,
        action: item.status.replace(/_/g, ' ').toLowerCase(),
        procurement: item.title,
        requestNo: item.requestNo,
        timestamp: item.updatedAt || item.createdAt,
        role: item.currentOwnerRole || 'SYSTEM',
      }));
      setRecentActivity(activity);
    } catch {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getRoleGreeting = () => {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return `${timeGreeting}, ${user?.fullName?.split(' ')[0] || 'there'}`;
  };

  const getRoleDescription = () => {
    const descriptions: Record<string, string> = {
      REQUESTER: 'Create and track your procurement requests',
      PROCUREMENT: 'Manage the full procurement lifecycle',
      VENDOR: 'View invitations and submit proposals',
      EVALUATOR: 'Score and evaluate vendor submissions',
      LEAD_EVALUATOR: 'Lead evaluation and provide recommendations',
      APPROVER: 'Review and approve procurement decisions',
      ADMIN: 'System administration and user management',
    };
    return descriptions[user?.role || ''] || 'Manage your procurement activities';
  };

  const getQuickActions = () => {
    const actions: Array<{ label: string; path: string; icon: string; color: string }> = [];
    switch (user?.role) {
      case 'REQUESTER':
        actions.push(
          { label: 'New Request', path: '/procurements/new', icon: 'Add', color: 'primary.main' },
          { label: 'My Requests', path: '/procurements', icon: 'Assignment', color: 'primary.dark' },
        );
        break;
      case 'PROCUREMENT':
        actions.push(
          { label: 'All Procurements', path: '/procurements', icon: 'Assignment', color: 'primary.dark' },
          { label: 'Invite Vendors', path: '/invitations', icon: 'Mail', color: 'warning.main' },
          { label: 'Bidding Control', path: '/bidding', icon: 'Gavel', color: 'error.main' },
          { label: 'Reports', path: '/reporting', icon: 'Timeline', color: 'info.main' },
        );
        break;
      case 'VENDOR':
        actions.push(
          { label: 'My Invitations', path: '/invitations', icon: 'Mail', color: 'warning.main' },
          { label: 'Submit Proposal', path: '/submissions', icon: 'Send', color: 'primary.main' },
          { label: 'Bidding Room', path: '/bidding', icon: 'Gavel', color: 'error.main' },
          { label: 'My Results', path: '/results', icon: 'CheckCircle', color: 'success.main' },
          { label: 'Analytics', path: '/analytics', icon: 'TrendingUp', color: 'info.main' },
        );
        break;
      case 'EVALUATOR':
      case 'LEAD_EVALUATOR':
        actions.push(
          { label: 'Evaluation Queue', path: '/evaluation', icon: 'Assessment', color: 'primary.main' },
          { label: 'My Results', path: '/results', icon: 'CheckCircle', color: 'success.main' },
        );
        break;
      case 'APPROVER':
        actions.push(
          { label: 'Approval Inbox', path: '/approvals', icon: 'Approval', color: 'warning.main' },
          { label: 'Reports', path: '/reporting', icon: 'Timeline', color: 'info.main' },
        );
        break;
      case 'ADMIN':
        actions.push(
          { label: 'All Procurements', path: '/procurements', icon: 'Assignment', color: 'primary.dark' },
          { label: 'Users', path: '/vendors', icon: 'People', color: 'primary.main' },
          { label: 'Audit Logs', path: '/audit', icon: 'History', color: 'error.main' },
          { label: 'Reports', path: '/reporting', icon: 'Timeline', color: 'info.main' },
        );
        break;
    }
    return actions;
  };

  const kpiCards = user?.role === 'VENDOR' ? [
    { title: 'Invitations', value: vendorAnalytics?.summary?.invitedCount || invitations.length, icon: 'Mail', color: 'info.main', bg: 'info.50', filter: '/invitations' },
    { title: 'Accepted', value: vendorAnalytics?.summary?.acceptedCount || 0, icon: 'CheckCircle', color: 'success.main', bg: 'success.50', filter: '/invitations' },
    { title: 'Submissions', value: vendorAnalytics?.summary?.submissionCount || 0, icon: 'Send', color: 'primary.main', bg: 'primary.50', filter: '/submissions' },
    { title: 'Bids', value: vendorAnalytics?.summary?.totalBids || 0, icon: 'Gavel', color: 'warning.main', bg: 'warning.50', filter: '/bidding' },
    { title: 'Results', value: vendorAnalytics?.summary?.resultCount || 0, icon: 'EmojiEvents', color: 'success.main', bg: 'success.50', filter: '/results' },
    { title: 'Analytics', value: '', icon: 'TrendingUp', color: 'primary.main', bg: 'primary.50', filter: '/analytics' },
  ] : [
    { title: 'Total', value: stats.total, icon: 'Assignment', color: 'primary.main', bg: 'primary.50', filter: '' },
    { title: 'Drafts', value: stats.drafts, icon: 'Edit', color: 'grey.600', bg: 'grey.100', filter: '?status=DRAFT' },
    { title: 'Pending', value: stats.pending, icon: 'Send', color: 'warning.main', bg: 'warning.50', filter: '?status=SUBMITTED' },
    { title: 'Active', value: stats.active, icon: 'Gavel', color: 'info.main', bg: 'info.50', filter: '?status=RFP_PUBLISHED' },
    { title: 'Completed', value: stats.completed, icon: 'CheckCircle', color: 'success.main', bg: 'success.50', filter: '?status=COMPLETED' },
    { title: 'Rejected', value: stats.rejected, icon: 'Cancel', color: 'error.main', bg: 'error.50', filter: '?status=REJECTED' },
  ];

  if (loading) {
    return (
      <Box>
        <LinearProgress sx={{ borderRadius: 1, mb: 3 }} />
        <Typography color="text.secondary">Loading dashboard...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Paper elevation={0} sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`, borderRadius: 3, color: 'white' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>{getRoleGreeting()}</Typography>
            <Typography variant="body1" sx={{ opacity: 0.85 }}>{getRoleDescription()}</Typography>
            <Chip label={user?.role?.replace(/_/g, ' ')} size="small" sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 500 }} />
          </Box>
          {['REQUESTER', 'PROCUREMENT'].includes(user?.role || '') && (
            <Button variant="contained" startIcon={<Icon name="Add" />} onClick={() => navigate('/procurements/new')} sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' }, fontWeight: 600, px: 3 }}>
              New Request
            </Button>
          )}
        </Box>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {kpiCards.map((kpi) => (
          <Grid item xs={4} sm={2} key={kpi.title}>
            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', '&:hover': { borderColor: kpi.color, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }, transition: 'all 0.2s', cursor: 'pointer' }} onClick={() => navigate(kpi.filter.startsWith('/') ? kpi.filter : `/procurements${kpi.filter}`)}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: kpi.color }}>
                    <Icon name={kpi.icon} />
                  </Box>
                  <Box>
                    <Typography variant="h4" fontWeight={700} color={kpi.color}>{kpi.value}</Typography>
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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>{user?.role === 'VENDOR' ? 'Recent Invitations' : 'Recent Procurements'}</Typography>
                <Button size="small" onClick={() => navigate(user?.role === 'VENDOR' ? '/invitations' : '/procurements')}>View All &rarr;</Button>
              </Box>
              <List disablePadding>
                {(user?.role === 'VENDOR' ? invitations : recentItems).length === 0 && (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Icon name={user?.role === 'VENDOR' ? 'Mail' : 'Assignment'} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {user?.role === 'VENDOR' ? 'No invitations yet' : 'No procurements yet'}
                    </Typography>
                  </Box>
                )}
                {(user?.role === 'VENDOR' ? invitations.slice(0, 5) : recentItems).map((item: any, idx: number, arr: any[]) => (
                  <React.Fragment key={item.id}>
                    <ListItem sx={{ px: 1, py: 1.5, cursor: 'pointer', borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }} onClick={() => navigate(user?.role === 'VENDOR' ? '/invitations' : `/procurements/${item.id}`)}>
                      <Avatar sx={{ width: 36, height: 36, mr: 1.5, bgcolor: user?.role === 'VENDOR' ? (item.status === 'ACCEPTED' ? 'success.main' : item.status === 'DECLINED' ? 'error.main' : 'warning.main') : (item.requestType === 'RFP' ? 'info.main' : item.requestType === 'RFQ' ? 'warning.main' : 'grey.600'), fontSize: 12, fontWeight: 700, color: 'white' }}>
                        {user?.role === 'VENDOR' ? (item.status?.charAt(0) || '?') : item.requestType}
                      </Avatar>
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight={500}>{user?.role === 'VENDOR' ? (item.procurement?.title || 'Invitation') : item.title}</Typography>}
                        secondary={<Typography variant="caption" color="text.secondary">{user?.role === 'VENDOR' ? item.procurement?.requestNo || '' : item.requestNo} | {user?.role === 'VENDOR' ? item.status : (item.property?.name || 'General')}</Typography>}
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" color="text.secondary">{new Date(user?.role === 'VENDOR' ? (item.invitedAt || item.createdAt) : item.createdAt).toLocaleDateString()}</Typography>
                        {user?.role !== 'VENDOR' && <StatusBadge status={item.status} />}
                      </Box>
                    </ListItem>
                    {idx < arr.length - 1 && <Divider sx={{ my: 0.5 }} />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Recent Activity</Typography>
              <List disablePadding>
                {recentActivity.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>No recent activity</Typography>
                )}
                {recentActivity.map((activity, idx) => (
                  <React.Fragment key={activity.id}>
                    <ListItem sx={{ px: 0, py: 1 }}>
                      <Avatar sx={{ width: 32, height: 32, mr: 1.5, bgcolor: 'info.50', color: 'info.main', fontSize: 14 }}>
                        <Icon name="Timeline" />
                      </Avatar>
                      <ListItemText
                        primary={<Typography variant="body2">{activity.action.charAt(0).toUpperCase() + activity.action.slice(1)}</Typography>}
                        secondary={<Typography variant="caption" color="text.secondary">{activity.requestNo} | {new Date(activity.timestamp).toLocaleString()}</Typography>}
                      />
                    </ListItem>
                    {idx < recentActivity.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Quick Actions</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {getQuickActions().map((action) => (
                  <Button key={action.path} fullWidth variant="outlined" startIcon={<Icon name={action.icon} />} onClick={() => navigate(action.path)} sx={{ justifyContent: 'flex-start', textTransform: 'none', py: 1.5, borderColor: 'divider', color: 'text.primary', '&:hover': { borderColor: action.color, bgcolor: `${action.color}08` } }}>
                    {action.label}
                  </Button>
                ))}
              </Box>
            </CardContent>
          </Card>

          {user?.role === 'APPROVER' && (
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" fontWeight={600}>Approval Inbox</Typography>
                  <Chip label={approvals.length} size="small" color={approvals.length > 0 ? 'warning' : 'default'} />
                </Box>
                <List disablePadding>
                  {approvals.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>No pending approvals</Typography>
                  )}
                  {approvals.slice(0, 4).map((item: any, idx: number) => (
                    <React.Fragment key={item.id}>
                      <ListItem sx={{ px: 0, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderRadius: 1 }} onClick={() => navigate(`/procurements/${item.id}`)}>
                        <ListItemText
                          primary={<Typography variant="body2" fontWeight={500}>{item.title}</Typography>}
                          secondary={item.requestNo}
                        />
                      </ListItem>
                      {idx < Math.min(approvals.length, 4) - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
                {approvals.length > 4 && (
                  <Button size="small" fullWidth sx={{ mt: 1 }} onClick={() => navigate('/approvals')}>View all {approvals.length} approvals</Button>
                )}
              </CardContent>
            </Card>
          )}

          {user?.role === 'VENDOR' && invitations.length > 0 && (
            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" fontWeight={600}>Pending Invitations</Typography>
                  <Chip label={invitations.filter((i: any) => i.invitationStatus === 'PENDING').length} size="small" color="info" />
                </Box>
                <List disablePadding>
                  {invitations.filter((i: any) => i.invitationStatus === 'PENDING').slice(0, 3).map((inv: any, idx: number) => (
                    <React.Fragment key={inv.id}>
                      <ListItem sx={{ px: 0, cursor: 'pointer' }} onClick={() => navigate('/invitations')}>
                        <ListItemText
                          primary={<Typography variant="body2" fontWeight={500}>{inv.procurement?.title}</Typography>}
                          secondary={inv.procurement?.requestNo}
                        />
                      </ListItem>
                      {idx < 2 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
