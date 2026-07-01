import { useEffect, useState, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, Chip, CircularProgress, LinearProgress,
} from '@mui/material';
import { Icon } from '../components/Icon';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function SubmissionsPage() {
  const { user } = useAuth();
  const [procurements, setProcurements] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ procurementId: '', price: '', proposalText: '' });
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState<{ id: string; fileName: string; fileSize: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.get('/procurements', { params: { status: 'RFQ_OPEN', limit: 50 } });
      setProcurements(res.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      await api.post('/rfq-submissions', {
        procurementId: form.procurementId,
        price: parseFloat(form.price),
        proposalText: form.proposalText,
        fileIds: attachments.map(a => a.id),
      });
      setDialogOpen(false);
      setForm({ procurementId: '', price: '', proposalText: '' });
      setAttachments([]);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('File size must be under 10MB'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAttachments(prev => [...prev, { id: res.data.id, fileName: res.data.fileName, fileSize: res.data.fileSize }]);
    } catch { setError('Failed to upload file'); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleRemoveAttachment = async (id: string) => {
    try { await api.delete(`/files/${id}`); } catch {}
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Submissions</Typography>
        {user?.role === 'VENDOR' && (
          <Button variant="contained" startIcon={<Icon name="Add" />} onClick={() => setDialogOpen(true)}>New Submission</Button>
        )}
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><LinearProgress sx={{ width: '100%', borderRadius: 1 }} /></Box>
      ) : procurements.length === 0 ? (
        <Card><CardContent><Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>No open RFQs available for submission</Typography></CardContent></Card>
      ) : (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Open RFQs</Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Request No</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Deadline</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {procurements.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.requestNo}</TableCell>
                      <TableCell>{p.title}</TableCell>
                      <TableCell><Chip label={p.status} size="small" color="primary" variant="outlined" /></TableCell>
                      <TableCell>{p.submissionDeadline ? new Date(p.submissionDeadline).toLocaleDateString() : 'No deadline'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Submission</DialogTitle>
        <DialogContent>
          <TextField select fullWidth label="Procurement" value={form.procurementId} onChange={(e) => setForm({ ...form, procurementId: e.target.value })} SelectProps={{ native: true }} sx={{ mt: 1, mb: 2 }}>
            <option value="">Select...</option>
            {procurements.map((p) => <option key={p.id} value={p.id}>{p.requestNo} - {p.title}</option>)}
          </TextField>
          <TextField fullWidth type="number" label="Price ($)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth multiline rows={4} label="Proposal" value={form.proposalText} onChange={(e) => setForm({ ...form, proposalText: e.target.value })} sx={{ mb: 2 }} />
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Attachments</Typography>
            <input ref={fileInputRef} type="file" hidden onChange={handleFileUpload} />
            <Button variant="outlined" size="small" startIcon={uploading ? <CircularProgress size={16} /> : <Icon name="AttachFile" />} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Attach File'}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>Max 10MB</Typography>
            {attachments.length > 0 && (
              <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {attachments.map(att => (
                  <Box key={att.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 0.5 }}>
                    <Icon name="Description" sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body2" sx={{ flex: 1 }}>{att.fileName}</Typography>
                    <Typography variant="caption" color="text.secondary">{(att.fileSize / 1024).toFixed(0)}KB</Typography>
                    <Button size="small" color="error" onClick={() => handleRemoveAttachment(att.id)} sx={{ minWidth: 0, p: 0 }}>
                      <Icon name="Close" sx={{ fontSize: 16 }} />
                    </Button>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!form.procurementId || !form.price}>Submit</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
