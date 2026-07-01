import { Icon } from '../components/Icon';
import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, IconButton, Tooltip, FormControl, InputLabel, Select, MenuItem,
  InputAdornment, FormControlLabel, Checkbox,
} from '@mui/material';
import api from '../services/api';

const ROLES = [
  { value: 'REQUESTER', label: 'Requester', color: 'grey.600' },
  { value: 'PROCUREMENT', label: 'Procurement', color: 'info.main' },
  { value: 'VENDOR', label: 'Vendor', color: 'warning.main' },
  { value: 'EVALUATOR', label: 'Evaluator', color: 'primary.main' },
  { value: 'LEAD_EVALUATOR', label: 'Lead Evaluator', color: 'secondary.main' },
  { value: 'APPROVER', label: 'Approver', color: 'success.main' },
  { value: 'ADMIN', label: 'Admin', color: 'error.main' },
];

interface Property { id: string; name: string; }
interface Department { id: string; name: string; }

export default function VendorsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form, setForm] = useState({
    email: '', password: '', fullName: '', role: 'REQUESTER' as string,
    propertyId: '', departmentId: '', managerId: '', companyName: '', newPassword: '', confirmPassword: '', isActive: true,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createdUser, setCreatedUser] = useState<any>(null);
  const [createReveal, setCreateReveal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [properties, setProperties] = useState<Property[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [total, setTotal] = useState(0);

  useEffect(() => { load(); loadProperties(); }, [searchQuery, roleFilter, statusFilter, page, rowsPerPage]);

  const load = async () => {
    try {
      const params: any = { limit: rowsPerPage, page: page + 1 };
      if (searchQuery) params.search = searchQuery;
      if (roleFilter !== 'ALL') params.role = roleFilter;
      if (statusFilter === 'ACTIVE') params.isActive = 'true';
      else if (statusFilter === 'INACTIVE') params.isActive = 'false';
      else if (statusFilter === 'LOCKED') params.locked = 'true';
      const res = await api.get('/users', { params });
      setUsers(res.data.data || []);
      setTotal(res.data.meta?.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed');
    }
  };

  const loadProperties = async () => {
    try {
      const res = await api.get('/users/properties');
      setProperties(res.data || []);
    } catch {
      setProperties([]);
    }
  };

  const loadDepartments = async (propertyId: string) => {
    if (!propertyId) { setDepartments([]); return; }
    try {
      const res = await api.get(`/users/departments/${propertyId}`);
      setDepartments(res.data || []);
    } catch {
      setDepartments([]);
    }
  };

  const filteredUsers = users;

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPassword = (pw: string) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(pw);

  const handleCreate = async () => {
    setError('');
    setSuccess('');
    if (!isValidEmail(form.email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!isValidPassword(form.password)) {
      setError('Password must be at least 8 characters with uppercase, lowercase, and number');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      const payload: any = { email: form.email, password: form.password, fullName: form.fullName, role: form.role };
      if (form.role === 'VENDOR') {
        if (form.companyName) payload.companyName = form.companyName;
      } else {
        if (form.propertyId && form.propertyId !== 'none') payload.propertyId = form.propertyId;
        if (form.departmentId && form.departmentId !== 'none') payload.departmentId = form.departmentId;
        if (form.managerId && form.managerId !== 'none') payload.managerId = form.managerId;
      }
      const res = await api.post('/users', payload);
      setCreatedUser({ ...res.data, password: form.password });
      setSuccess('User created successfully');
    setForm({ email: '', password: '', fullName: '', role: 'REQUESTER', propertyId: '', departmentId: '', managerId: '', companyName: '', newPassword: '', confirmPassword: '', isActive: true });
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create user');
    }
  };

  const handleEdit = async () => {
    setError('');
    setSuccess('');
    if (!isValidEmail(form.email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (form.newPassword && !isValidPassword(form.newPassword)) {
      setError('Min 8 chars, uppercase, lowercase, and number required');
      return;
    }
    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      const payload: any = { email: form.email, fullName: form.fullName, role: form.role, isActive: form.isActive };
      if (form.role === 'VENDOR') {
        payload.companyName = form.companyName || null;
        payload.propertyId = null;
        payload.departmentId = null;
      } else {
        payload.propertyId = form.propertyId || null;
        payload.departmentId = form.departmentId || null;
        payload.managerId = form.managerId || null;
      }
      if (form.newPassword) payload.password = form.newPassword;
      await api.patch(`/users/${editingUser.id}`, payload);
      setSuccess('User updated successfully');
      setDialogOpen(false);
      setEditMode(false);
      setEditingUser(null);
    setForm({ email: '', password: '', fullName: '', role: 'REQUESTER', propertyId: '', departmentId: '', managerId: '', companyName: '', newPassword: '', confirmPassword: '', isActive: true });
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update user');
    }
  };

  const handleDelete = async (user: any) => {
    if (!window.confirm(`Are you sure you want to DELETE ${user.fullName} (${user.email})?\n\nThis will permanently remove them from the database. This action cannot be undone.`)) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/users/${user.id}`);
      setSuccess(`${user.fullName} has been deleted`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleUnlock = async (user: any) => {
    if (!window.confirm(`Unlock ${user.fullName}'s account?`)) return;
    setError('');
    setSuccess('');
    try {
      await api.post(`/users/${user.id}/unlock`);
      setSuccess(`${user.fullName}'s account has been unlocked`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to unlock user');
    }
  };

  const openEditDialog = (user: any) => {
    setEditMode(true);
    setEditingUser(user);
    setForm({
      email: user.email || '',
      password: '',
      fullName: user.fullName || '',
      role: user.role || 'REQUESTER',
      propertyId: user.propertyId || '',
      departmentId: user.departmentId || '',
      managerId: user.managerId || '',
      companyName: user.vendor?.companyName || '',
      newPassword: '',
      confirmPassword: '',
      isActive: user.isActive !== false,
    });
    if (user.propertyId) loadDepartments(user.propertyId);
    setDialogOpen(true);
    setCreatedUser(null);
    setCreateReveal(false);
    setSuccess('');
    setError('');
  };

  const openCreateDialog = () => {
    setEditMode(false);
    setEditingUser(null);
    setForm({ email: '', password: '', fullName: '', role: 'REQUESTER', propertyId: '', departmentId: '', managerId: '', companyName: '', newPassword: '', confirmPassword: '', isActive: true });
    setDepartments([]);
    setDialogOpen(true);
    setCreatedUser(null);
    setCreateReveal(false);
    setSuccess('');
    setError('');
  };

  const getRoleColor = (role: string) => {
    return ROLES.find(r => r.value === role)?.color || 'grey.600';
  };

  const isVendorRole = form.role === 'VENDOR';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>User Management</Typography>
        <Button variant="contained" startIcon={<Icon name="Add" />} onClick={openCreateDialog}>Add User</Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Search and Filter Bar */}
      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 2 }}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ flex: 1, minWidth: 250 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Icon name="Search" /></InputAdornment>,
              }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Filter by Role</InputLabel>
              <Select
                value={roleFilter}
                label="Filter by Role"
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <MenuItem value="ALL">All Roles</MenuItem>
                {ROLES.map((r) => (
                  <MenuItem key={r.value} value={r.value}>
                    {r.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Filter by Status</InputLabel>
              <Select
                value={statusFilter}
                label="Filter by Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="ALL">All</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="INACTIVE">Inactive</MenuItem>
                <MenuItem value="LOCKED">Locked</MenuItem>
              </Select>
            </FormControl>
            {(searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <Chip
                label={`Found ${filteredUsers.length} users`}
                color="primary"
                size="small"
                onDelete={() => { setSearchQuery(''); setRoleFilter('ALL'); setStatusFilter('ALL'); }}
              />
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell align="left">Role</TableCell>
                <TableCell align="left">Company</TableCell>
                <TableCell align="left">Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell sx={{ fontWeight: 600 }}>{u.fullName}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell align="left">
                    <Chip label={u.role.replace(/_/g, ' ')} size="small" sx={{ bgcolor: `${getRoleColor(u.role)}15`, color: getRoleColor(u.role), fontWeight: 600 }} />
                  </TableCell>
                  <TableCell align="left">
                    {u.vendor?.companyName || <Typography variant="body2" color="text.secondary">—</Typography>}
                  </TableCell>
                  <TableCell align="left">
                    <Chip label={u.isActive ? (u.lockedUntil && new Date(u.lockedUntil) > new Date() ? 'Locked' : 'Active') : 'Inactive'} size="small" color={u.isActive ? (u.lockedUntil && new Date(u.lockedUntil) > new Date() ? 'warning' : 'success') : 'default'} />
                  </TableCell>
                  <TableCell>{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEditDialog(u)}>
                        <Icon name="Edit" sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={u.isActive ? 'Deactivate' : 'Already inactive'}>
                      <IconButton size="small" onClick={() => handleDelete(u)}>
                        <Icon name="Cancel" sx={{ fontSize: 18, color: u.isActive ? 'error.main' : 'grey.400' }} />
                      </IconButton>
                    </Tooltip>
                    {u.lockedUntil && new Date(u.lockedUntil) > new Date() && (
                      <Tooltip title="Unlock account">
                        <IconButton size="small" onClick={() => handleUnlock(u)}>
                          <Icon name="Lock" sx={{ fontSize: 18, color: 'warning.main' }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow><TableCell colSpan={7} align="center">
                  <Typography sx={{ py: 3 }} color="text.secondary">
                    {searchQuery || roleFilter !== 'ALL' ? 'No users match your search' : 'No users'}
                  </Typography>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            Showing {page * rowsPerPage + 1}–{Math.min((page + 1) * rowsPerPage, total)} of {total} users
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">Rows per page:</Typography>
            <Select value={rowsPerPage} size="small" onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}>
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={25}>25</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
            </Select>
            <Button size="small" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Typography variant="body2">{page + 1} / {Math.ceil(total / rowsPerPage) || 1}</Typography>
            <Button size="small" disabled={(page + 1) * rowsPerPage >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </Box>
        </Box>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setCreateReveal(false); }} maxWidth="sm" fullWidth>
        <DialogTitle>{editMode ? 'Edit User' : 'Add New User'}</DialogTitle>
        <DialogContent>
          {createdUser ? (
            <Alert severity="success" sx={{ mt: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>User created with login credentials:</Typography>
              <Typography variant="body2"><strong>Email:</strong> {createdUser.email}</Typography>
              <Typography variant="body2"><strong>Password:</strong> {createReveal ? createdUser.password : '••••••••'}</Typography>
              <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                <Button size="small" variant="outlined" onClick={() => setCreateReveal(!createReveal)}>
                  {createReveal ? 'Hide' : 'Show'} Password
                </Button>
                {createReveal && (
                  <Button size="small" variant="contained" onClick={() => { navigator.clipboard.writeText(createdUser.password); setSuccess('Password copied!'); }}>
                    Copy
                  </Button>
                )}
              </Box>
              <Typography variant="body2"><strong>Role:</strong> {createdUser.role}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>Share these credentials with the user securely. Password shown once only.</Typography>
            </Alert>
          ) : (
            <>
              <TextField fullWidth label="Full Name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} sx={{ mt: 1, mb: 2 }} required />
              <TextField fullWidth label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={form.email !== '' && !isValidEmail(form.email)} helperText={form.email !== '' && !isValidEmail(form.email) ? 'Enter a valid email (e.g. user@domain.com)' : ''} sx={{ mb: 2 }} required />
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Role</InputLabel>
                <Select value={form.role} label="Role" onChange={(e) => setForm({ ...form, role: e.target.value, propertyId: '', departmentId: '' })}>
                  {ROLES.map((r) => (
                    <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {isVendorRole && (
                <TextField
                  fullWidth
                  label="Company Name"
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  sx={{ mb: 2 }}
                  required
                  placeholder="e.g. Smart Systems Thailand"
                />
              )}

              {!isVendorRole && (
                <>
                  <FormControl fullWidth sx={{ mb: 2 }} disabled={isVendorRole}>
                    <InputLabel>Property</InputLabel>
                    <Select value={form.propertyId} label="Property" onChange={(e) => {
                      const val = e.target.value;
                      setForm({ ...form, propertyId: val, departmentId: '' });
                      loadDepartments(val);
                    }}>
                      <MenuItem value=""><em>Not assigned</em></MenuItem>
                      {properties.map((p) => (
                        <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth sx={{ mb: 2 }} disabled={isVendorRole || !form.propertyId}>
                    <InputLabel>Department</InputLabel>
                    <Select value={form.departmentId} label="Department" onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                      <MenuItem value=""><em>Not assigned</em></MenuItem>
                      {departments.map((d) => (
                        <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth sx={{ mb: 2 }} disabled={isVendorRole}>
                    <InputLabel>Manager (Approver)</InputLabel>
                    <Select value={form.managerId} label="Manager (Approver)" onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
                      <MenuItem value=""><em>No manager</em></MenuItem>
                      {users.filter((u) => u.role === 'APPROVER' && u.id !== form.managerId).map((u) => (
                        <MenuItem key={u.id} value={u.id}>{u.fullName} ({u.email})</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </>
              )}

              {!editMode && (
                <>
                  <TextField fullWidth label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={form.password !== '' && !isValidPassword(form.password)} helperText={form.password !== '' && !isValidPassword(form.password) ? 'Min 8 chars, uppercase, lowercase, and number required' : ''} sx={{ mb: 2 }} />
                  <TextField fullWidth label="Confirm Password" type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} error={form.password !== '' && form.password !== form.confirmPassword} helperText={form.password !== '' && form.password !== form.confirmPassword ? 'Passwords do not match' : ''} sx={{ mb: 2 }} />
                </>
              )}

              {editMode && (
                <>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, mt: 1 }}>Change Password (leave blank to keep current)</Typography>
                  <TextField fullWidth label="New Password" type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} error={form.newPassword !== '' && !isValidPassword(form.newPassword)} helperText={form.newPassword !== '' && !isValidPassword(form.newPassword) ? 'Password must be at least 6 characters' : ''} sx={{ mb: 2 }} />
                  <TextField fullWidth label="Confirm Password" type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} error={form.newPassword !== '' && form.newPassword !== form.confirmPassword} helperText={form.newPassword !== '' && form.newPassword !== form.confirmPassword ? 'Passwords do not match' : ''} sx={{ mb: 2 }} />
                  <FormControlLabel
                    control={<Checkbox checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} color="success" />}
                    label={<Typography variant="body2" fontWeight={500}>Active</Typography>}
                  />
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{createdUser ? 'Close' : 'Cancel'}</Button>
          {!createdUser && editMode && <Button variant="contained" onClick={handleEdit} disabled={!form.fullName || !form.email || !isValidEmail(form.email)}>Save Changes</Button>}
          {!createdUser && !editMode && <Button variant="contained" onClick={handleCreate} disabled={!form.fullName || !form.email || !isValidEmail(form.email) || !isValidPassword(form.password)}>Create User</Button>}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
