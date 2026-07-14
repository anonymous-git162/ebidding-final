import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItemButton, ListItemIcon,
  ListItemText, Avatar, IconButton, Menu, MenuItem, Divider, useTheme, useMediaQuery, Badge, Chip, Tooltip,
} from '@mui/material';
import { Icon } from '../components/Icon';
import CopilotChat from '../components/CopilotChat';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';
import api from '../services/api';

import { useThemeMode } from '../contexts/ThemeContext';

const DRAWER_WIDTH = 260;

const NAVIGATION_ITEMS: Record<string, Array<{ label: string; path: string; icon: string }>> = {
  PROCUREMENT: [
    { label: 'Dashboard', path: '/dashboard', icon: 'Dashboard' },
    { label: 'Procurements', path: '/procurements', icon: 'Assignment' },
    { label: 'User Management', path: '/vendors', icon: 'People' },
    { label: 'Invitations', path: '/invitations', icon: 'Mail' },
    { label: 'Bidding', path: '/bidding', icon: 'Gavel' },
    { label: 'Evaluation', path: '/evaluation', icon: 'Assessment' },
    { label: 'Approvals', path: '/approvals', icon: 'Approval' },
    { label: 'Results', path: '/results', icon: 'CheckCircle' },
    { label: 'Reports', path: '/reporting', icon: 'Timeline' },
    { label: 'Audit Logs', path: '/audit', icon: 'History' },
  ],
  REQUESTER: [
    { label: 'Dashboard', path: '/dashboard', icon: 'Dashboard' },
    { label: 'My Requests', path: '/procurements', icon: 'Assignment' },
  ],
  VENDOR: [
    { label: 'Dashboard', path: '/dashboard', icon: 'Dashboard' },
    { label: 'My Invitations', path: '/invitations', icon: 'Mail' },
    { label: 'Submissions', path: '/submissions', icon: 'Send' },
    { label: 'Bidding', path: '/bidding', icon: 'Gavel' },
    { label: 'Results', path: '/results', icon: 'CheckCircle' },
    { label: 'Analytics', path: '/analytics', icon: 'TrendingUp' },
  ],
  EVALUATOR: [
    { label: 'Dashboard', path: '/dashboard', icon: 'Dashboard' },
    { label: 'Evaluation Queue', path: '/evaluation', icon: 'Assessment' },
    { label: 'Results', path: '/results', icon: 'CheckCircle' },
  ],
  LEAD_EVALUATOR: [
    { label: 'Dashboard', path: '/dashboard', icon: 'Dashboard' },
    { label: 'Evaluation Queue', path: '/evaluation', icon: 'Assessment' },
    { label: 'Results', path: '/results', icon: 'CheckCircle' },
  ],
  APPROVER: [
    { label: 'Dashboard', path: '/dashboard', icon: 'Dashboard' },
    { label: 'Procurements', path: '/procurements', icon: 'Assignment' },
    { label: 'Approval Inbox', path: '/approvals', icon: 'Approval' },
    { label: 'Reports', path: '/reporting', icon: 'Timeline' },
    { label: 'Audit Logs', path: '/audit', icon: 'History' },
  ],
  ADMIN: [
    { label: 'Dashboard', path: '/dashboard', icon: 'Dashboard' },
    { label: 'Procurements', path: '/procurements', icon: 'Assignment' },
    { label: 'User Management', path: '/vendors', icon: 'People' },
    { label: 'Reports', path: '/reporting', icon: 'Timeline' },
    { label: 'Audit Logs', path: '/audit', icon: 'History' },
  ],
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; message: string; read: boolean; link?: string }>>([]);
  const { on } = useSocket();

  useEffect(() => { loadNotifications(); }, [user?.role]);

  // Real-time notification listener
  useEffect(() => {
    const unsubscribe = on('notification', (data: { id: string; title: string; message: string; link?: string }) => {
      setNotifications(prev => [{ id: data.id, title: data.title, message: data.message, read: false, link: data.link }, ...prev]);
    });
    return unsubscribe;
  }, [on]);

  const loadNotifications = async () => {
    try {
      const res = await api.get('/notifications', { params: { unread: 'true' } });
      setNotifications((res.data || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        read: !!n.readAt,
        link: n.link,
      })));
    } catch { /* ignore */ }
  };

  const navItems = NAVIGATION_ITEMS[user?.role || 'REQUESTER'] || NAVIGATION_ITEMS.REQUESTER;

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 16 }}>CB</Typography>
        </Box>
        <Typography variant="h6" fontWeight={700} color="primary">CenBidding</Typography>
      </Box>
      <Divider />
      <List sx={{ flex: 1, px: 1 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.path}
            selected={location.pathname === item.path}
            onClick={() => { navigate(item.path); if (isMobile) setMobileOpen(false); }}
            sx={{ borderRadius: 1.5, mb: 0.5, '&.Mui-selected': { bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' }, '& .MuiListItemIcon-root': { color: 'white' } } }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}><Icon name={item.icon} /></ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light' }}>
          {user?.fullName?.charAt(0) || 'U'}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>{user?.fullName}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{user?.role}</Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" elevation={0} sx={{ bgcolor: 'background.paper', color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar>
          <IconButton edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 2, display: { md: 'none' } }}>
            <Icon name="Menu" />
          </IconButton>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton onClick={toggleTheme} sx={{ mr: 1, transition: 'transform 0.3s ease', '&:hover': { transform: 'rotate(30deg)' } }}>
              <Icon name={mode === 'dark' ? 'LightMode' : 'DarkMode'} />
            </IconButton>
          </Tooltip>
          <IconButton onClick={(e) => setNotifAnchorEl(e.currentTarget)} sx={{ mr: 1, position: 'relative' }}>
            <Badge
              badgeContent={notifications.length}
              color="error"
              max={99}
              sx={{ '& .MuiBadge-badge': { position: 'absolute', top: 4, right: 4, height: 20, minWidth: 20, borderRadius: 10, fontSize: 11, fontWeight: 700, border: '2px solid', borderColor: 'background.paper', bgcolor: 'error.main', animation: notifications.length > 0 ? 'bellPulse 2s ease-in-out infinite' : 'none' } }}
            >
              <Box sx={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: notifications.length > 0 ? 'error.50' : 'transparent', transition: 'all 0.2s', '&:hover': { bgcolor: 'error.100' } }}>
                <Icon name="Notifications" sx={{ color: notifications.length > 0 ? 'error.main' : 'text.secondary', fontSize: 22 }} />
              </Box>
            </Badge>
            <style>{`@keyframes bellPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }`}</style>
          </IconButton>
          <Menu anchorEl={notifAnchorEl} open={Boolean(notifAnchorEl)} onClose={() => setNotifAnchorEl(null)} PaperProps={{ sx: { width: 380, maxHeight: 450, borderRadius: 2, mt: 1 } }} transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
            <Box sx={{ px: 2.5, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'action.hover' }}>
              <Typography variant="subtitle1" fontWeight={700}>Notifications</Typography>
              {notifications.length > 0 && (
                <Chip label={`${notifications.length} new`} size="small" color="error" sx={{ height: 22, fontSize: 11, fontWeight: 600 }} />
              )}
            </Box>
            <Divider />
            {notifications.length === 0 && (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Icon name="NotificationsNone" />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No notifications yet</Typography>
              </Box>
            )}
            {notifications.map((n, idx) => (
              <MenuItem key={n.id} onClick={async () => { await api.post(`/notifications/${n.id}/read`).catch(() => {}); setNotifications(prev => prev.filter(x => x.id !== n.id)); setNotifAnchorEl(null); if (n.link) navigate(n.link); }} sx={{ whiteSpace: 'normal', py: 1.5, px: 2.5, borderBottom: idx < notifications.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: 'primary.50', display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 1.5, flexShrink: 0 }}>
                  <Icon name="Notifications" sx={{ fontSize: 18, color: 'primary.main' }} />
                </Box>
                <ListItemText
                  primary={<Typography variant="body2" fontWeight={600}>{n.title}</Typography>}
                  secondary={<Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>{n.message}</Typography>}
                />
              </MenuItem>
            ))}
            {notifications.length > 0 && (
              <>
                <Divider />
                <MenuItem onClick={async () => { await api.post('/notifications/read-all').catch(() => {}); setNotifications([]); setNotifAnchorEl(null); }} sx={{ justifyContent: 'center', py: 1.5 }}>
                  <Typography variant="body2" fontWeight={600} color="primary">Clear all notifications</Typography>
                </MenuItem>
              </>
            )}
          </Menu>
          <IconButton aria-label="Open user menu" onClick={(e) => setAnchorEl(e.currentTarget)}>
            <Badge color="error" variant="dot">
              <Icon name="Person" />
            </Badge>
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled>
              <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { setAnchorEl(null); navigate('/change-password'); }}>
              <ListItemIcon><Icon name="Lock" /></ListItemIcon>
              Change Password
            </MenuItem>
            <MenuItem onClick={() => { logout(); navigate('/login'); }}>
              <ListItemIcon><Icon name="Logout" /></ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {isMobile ? (
        <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}>
          {drawer}
        </Drawer>
      ) : (
        <Drawer variant="permanent" sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, borderRight: '1px solid', borderColor: 'divider' } }}>
          {drawer}
        </Drawer>
      )}

      <Box component="main" sx={{ flex: 1, ml: { md: `${DRAWER_WIDTH}px` }, mt: '64px', p: 3, bgcolor: 'background.default' }}>
        <Outlet />
      </Box>
      <CopilotChat />
    </Box>
  );
}
