import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, Chip, LinearProgress,
} from '@mui/material';
import { Icon } from '../components/Icon';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import FileUploader from '../components/FileUploader';

export default function SubmissionsPage() {
  const { user } = useAuth();
  const [procurements, setProcurements] = useState<any[]>([]);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ procurementId: '', price: '', proposalText: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fileAttachments, setFileAttachments] = useState<{ id: string; fileName: string; fileSize: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [fileUploadKey, setFileUploadKey] = useState(0);

  useEffect(() => { load(); }, []);

  const submittedIds = new Set(mySubmissions.filter(s => s.status === 'SUBMITTED').map(s => s.procurementId));

  const load = async () => {
    try {
      const statusFilter = user?.role === 'VENDOR' ? 'RFQ_OPEN,RFP_PUBLISHED,RFI_PUBLISHED' : 'RFQ_OPEN';
      const [procRes, invRes, subRes] = await Promise.all([
        api.get('/procurements', { params: { status: statusFilter, limit: 50 } }),
        api.get('/vendor-invitations/my').catch(() => ({ data: [] })),
        api.get('/rfq-submissions/my').catch(() => ({ data: [] })),
      ]);

      let list = procRes.data.data || [];
      if (user?.role === 'VENDOR') {
        const acceptedIds = (invRes.data || [])
          .filter((inv: any) => inv.invitationStatus === 'ACCEPTED')
          .map((inv: any) => inv.procurementId);
        list = list.filter((p: any) => acceptedIds.includes(p.id));
      }
      setProcurements(list);
      setMySubmissions(subRes.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const { data } = await api.post('/rfq-submissions', {
        procurementId: form.procurementId,
        price: parseFloat(form.price),
        proposalText: form.proposalText,
        fileIds: fileAttachments.map(a => a.id),
      });
      if (data?.id) {
        await api.put(`/rfq-submissions/${data.id}/submit`);
        setMySubmissions(prev => [...prev, { ...data, status: 'SUBMITTED', procurementId: form.procurementId }]);
      }
      setDialogOpen(false);
      setForm({ procurementId: '', price: '', proposalText: '' });
      setFileAttachments([]);
      setFileUploadKey(k => k + 1);
      setSuccess('Submission sent successfully!');
      load();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Submissions</Typography>
        {user?.role === 'VENDOR' && (
          <Button variant="contained" startIcon={<Icon name="Add" />} onClick={() => setDialogOpen(true)}>New Submission</Button>
        )}
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

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
                    <TableCell align="center">My Submission</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {procurements.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.requestNo}</TableCell>
                      <TableCell>{p.title}</TableCell>
                      <TableCell><Chip label={p.status} size="small" color="primary" variant="outlined" /></TableCell>
                      <TableCell>{p.submissionDeadline ? new Date(p.submissionDeadline).toLocaleDateString() : 'No deadline'}</TableCell>
                      <TableCell align="center">
                        {submittedIds.has(p.id) ? (
                          <Chip label="Submitted" size="small" color="success" icon={<Icon name="CheckCircle" />} />
                        ) : (
                          <Chip label="Not yet" size="small" variant="outlined" color="default" />
                        )}
                      </TableCell>
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
            <FileUploader key={fileUploadKey} onAttachmentsChange={setFileAttachments} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!form.procurementId || !form.price || parseFloat(form.price) <= 0}>Submit</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
