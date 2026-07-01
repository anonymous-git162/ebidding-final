import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, TextField, Grid, FormControl,
  InputLabel, Select, MenuItem, Alert, CircularProgress, InputAdornment,
} from '@mui/material';
import { Icon } from '../components/Icon';
import api from '../services/api';

const CATEGORIES = [
  'IT Infrastructure', 'Software & Licensing', 'Office Supplies', 'Furniture & Equipment',
  'Facilities & Maintenance', 'Professional Services', 'Marketing & Advertising',
  'Travel & Transportation', 'Legal Services', 'Consulting', 'Training & Development',
  'Construction & Renovation', 'Security Services', 'Other',
];

const CURRENCIES = [
  { code: 'USD', label: 'USD - US Dollar', symbol: '$' },
  { code: 'EUR', label: 'EUR - Euro', symbol: '€' },
  { code: 'GBP', label: 'GBP - British Pound', symbol: '£' },
  { code: 'THB', label: 'THB - Thai Baht', symbol: '฿' },
  { code: 'JPY', label: 'JPY - Japanese Yen', symbol: '¥' },
  { code: 'CNY', label: 'CNY - Chinese Yuan', symbol: '¥' },
  { code: 'SGD', label: 'SGD - Singapore Dollar', symbol: 'S$' },
  { code: 'AUD', label: 'AUD - Australian Dollar', symbol: 'A$' },
  { code: 'CAD', label: 'CAD - Canadian Dollar', symbol: 'C$' },
  { code: 'MYR', label: 'MYR - Malaysian Ringgit', symbol: 'RM' },
  { code: 'IDR', label: 'IDR - Indonesian Rupiah', symbol: 'Rp' },
];

export default function ProcurementEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    businessNeed: '',
    category: '',
    currency: 'USD',
    budgetEstimate: '',
    justification: '',
  });

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const res = await api.get(`/procurements/${id}`);
      const p = res.data;
      if (p.status !== 'DRAFT' && p.status !== 'RETURNED_FOR_REVISION') {
        setError('Can only edit draft or returned procurements');
        return;
      }
      setForm({
        title: p.title || '',
        description: p.description || '',
        businessNeed: p.businessNeed || '',
        category: p.category || '',
        currency: p.currency || 'USD',
        budgetEstimate: p.budgetEstimate ? String(p.budgetEstimate) : '',
        justification: p.justification || '',
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.title || form.title.length < 3) {
      setError('Title must be at least 3 characters');
      return;
    }
    if (form.budgetEstimate && (isNaN(parseFloat(form.budgetEstimate)) || parseFloat(form.budgetEstimate) < 0)) {
      setError('Budget must be a valid positive amount');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.patch(`/procurements/${id}`, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        businessNeed: form.businessNeed.trim() || undefined,
        category: form.category || undefined,
        currency: form.currency,
        budgetEstimate: form.budgetEstimate ? parseFloat(form.budgetEstimate) : undefined,
        justification: form.justification.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => navigate(`/procurements/${id}`), 1000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Button startIcon={<Icon name="ArrowBack" />} onClick={() => navigate(`/procurements/${id}`)}>Back</Button>
        <Typography variant="h5" fontWeight={700}>Edit Procurement</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>Saved successfully! Redirecting...</Alert>}

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField fullWidth required label="Title" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                inputProps={{ maxLength: 200 }}
                helperText={`${form.title.length} / 200 characters`} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline minRows={4} label="Description"
                placeholder="Provide a detailed description including scope, specifications..."
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline minRows={2} label="Business Need"
                placeholder="Why is this procurement needed?"
                value={form.businessNeed} onChange={(e) => setForm({ ...form, businessNeed: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select value={form.category} label="Category" onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <MenuItem value=""><em>Select category</em></MenuItem>
                  {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Currency</InputLabel>
                <Select value={form.currency} label="Currency" onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  {CURRENCIES.map((c) => <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth type="number" label="Budget Estimate"
                InputProps={{ startAdornment: <InputAdornment position="start">{CURRENCIES.find((c) => c.code === form.currency)?.symbol || '$'}</InputAdornment> }}
                value={form.budgetEstimate} onChange={(e) => setForm({ ...form, budgetEstimate: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline minRows={2} label="Justification"
                placeholder="Why is this needed? What happens if not procured?"
                value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} />
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            <Button variant="outlined" onClick={() => navigate(`/procurements/${id}`)}>Cancel</Button>
            <Button variant="contained" onClick={handleSave} disabled={saving || !form.title}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
