import { Icon } from '../components/Icon';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, TextField, Grid, FormControl, InputLabel,
  Select, MenuItem, Alert, Stepper, Step, StepLabel, Chip, Divider, Paper, Snackbar,
  InputAdornment, Tooltip, CircularProgress, Collapse, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import api from '../services/api';
import { CURRENCIES, CATEGORIES } from '../utils/constants';
import { TYPE_COLORS } from '../utils/statusColors';
import FileUploader from '../components/FileUploader';

const REQUEST_TYPES = [
  { value: 'RFI', label: 'RFI', subtitle: 'Request for Information', description: 'Gather information from vendors before making procurement decisions', color: TYPE_COLORS.RFI, icon: 'Search' },
  { value: 'RFP', label: 'RFP', subtitle: 'Request for Proposal', description: 'Vendors submit detailed proposals with approach, methodology, and pricing', color: TYPE_COLORS.RFP, icon: 'Assignment' },
  { value: 'RFQ', label: 'RFQ', subtitle: 'Request for Quotation', description: 'Vendors provide accurate pricing information for specific goods or offered services', color: TYPE_COLORS.RFQ, icon: 'Gavel' },
];

const STEPS = ['Request Type', 'Basic Information', 'Budget & Category', 'Review & Submit'];

export default function ProcurementCreatePage() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState({
    requestType: 'RFP',
    title: '',
    description: '',
    businessNeed: '',
    propertyId: '',
    departmentId: '',
    category: '',
    currency: 'USD',
    budgetEstimate: '',
    justification: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiTor, setAiTor] = useState('');
  const [properties, setProperties] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [propertiesError, setPropertiesError] = useState('');
  const [fileAttachments, setFileAttachments] = useState<{ id: string; fileName: string; fileSize: number }[]>([]);

  useEffect(() => {
    api.get('/users/properties').then((res) => setProperties(res.data || [])).catch(() => setPropertiesError('Could not load properties'));
  }, []);

  useEffect(() => {
    if (form.propertyId && form.propertyId !== 'none') {
      api.get(`/users/departments/${form.propertyId}`).then((res) => setDepartments(res.data || [])).catch(() => setDepartments([]));
    } else {
      setDepartments([]);
    }
  }, [form.propertyId]);

  const markTouched = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));

  const handleWriteTor = async () => {
    if (!form.title) return;
    setAiLoading(true);
    try {
      const res = await api.post('/ai/write-tor', {
        requestType: form.requestType,
        category: form.category || 'General',
        title: form.title,
        description: form.description,
      });
      setAiTor(res.data.tor);
      setAiDialogOpen(true);
    } catch {
      setAiTor('Failed to generate TOR. Please try again.');
      setAiDialogOpen(true);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAcceptTor = () => {
    setForm({ ...form, description: aiTor });
    setAiDialogOpen(false);
  };

  const validate = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 1 || step === 3) {
      if (!form.title || form.title.length < 3) newErrors.title = 'Title must be at least 3 characters';
      if (!form.description || form.description.length < 10) newErrors.description = 'Description must be at least 10 characters';
    }
    if (step === 2 || step === 3) {
      if (form.budgetEstimate && (isNaN(parseFloat(form.budgetEstimate)) || parseFloat(form.budgetEstimate) < 0)) {
        newErrors.budgetEstimate = 'Please enter a valid positive amount';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate(activeStep)) {
      setTouched({});
      setActiveStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    } else {
      setTouched({ title: true, description: true });
    }
  };

  const handleBack = () => {
    setErrors({});
    setTouched({});
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSave = async (submit = false) => {
    if (!validate(1) || !validate(2)) { setActiveStep(1); return; }
    setLoading(true);
    setApiError('');
    try {
      const payload: any = { requestType: form.requestType, title: form.title.trim() };
      if (form.description) payload.description = form.description.trim();
      if (form.businessNeed) payload.businessNeed = form.businessNeed.trim();
      if (form.category) payload.category = form.category;
      if (form.currency) payload.currency = form.currency;
      if (form.justification) payload.justification = form.justification.trim();
      if (form.budgetEstimate) payload.budgetEstimate = parseFloat(form.budgetEstimate);
      if (form.propertyId && form.propertyId !== 'general') payload.propertyId = form.propertyId;
      if (form.departmentId) payload.departmentId = form.departmentId;
      if (fileAttachments.length > 0) payload.fileIds = fileAttachments.map((a) => a.id);

      const res = await api.post('/procurements', payload);
      if (submit) await api.post(`/procurements/${res.data.id}/submit`);
      setSuccess(true);
      setTimeout(() => navigate(`/procurements/${res.data.id}`), 1500);
    } catch (err: any) {
      setApiError(err.response?.data?.message || 'Failed to create procurement');
    } finally {
      setLoading(false);
    }
  };

  const getStepStatus = (step: number) => {
    if (step < activeStep) return 'completed';
    if (step === activeStep) return 'active';
    return 'upcoming';
  };

  const renderTypeSelection = () => (
    <Box>
      <Typography variant="h6" fontWeight={600} gutterBottom>Select Request Type</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Choose the type of procurement request you want to create</Typography>
      <Grid container spacing={2}>
        {REQUEST_TYPES.map((type) => {
          const selected = form.requestType === type.value;
          return (
            <Grid item xs={12} sm={4} key={type.value}>
              <Paper
                elevation={0}
                onClick={() => setForm({ ...form, requestType: type.value })}
                sx={{
                  p: 0, cursor: 'pointer', border: '2px solid', borderColor: selected ? type.color : 'divider',
                  bgcolor: selected ? `${type.color}08` : 'background.paper', borderRadius: 2, transition: 'all 0.2s',
                  overflow: 'hidden', '&:hover': { borderColor: type.color },
                }}
              >
                <Box sx={{ bgcolor: type.color, color: 'white', px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Icon name={type.icon} />
                  <Typography variant="subtitle2" fontWeight={700}>{type.label}</Typography>
                </Box>
                <Box sx={{ p: 2.5 }}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>{type.subtitle}</Typography>
                  <Typography variant="body2" color="text.secondary">{type.description}</Typography>
                </Box>
                {selected && (
                  <Box sx={{ px: 2.5, pb: 2 }}>
                    <Chip label="Selected" size="small" sx={{ bgcolor: type.color, color: 'white', fontWeight: 600 }} />
                  </Box>
                )}
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );

  const renderBasicInfo = () => (
    <Box>
      <Typography variant="h6" fontWeight={600} gutterBottom>Basic Information</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Describe what you need to procure</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            fullWidth required label="Request Title" autoFocus
            placeholder="e.g., IT Network Infrastructure Upgrade 2026"
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            onBlur={() => markTouched('title')}
            error={touched.title && !!errors.title}
            helperText={touched.title && errors.title ? errors.title : `${form.title.length} / 200 characters`}
            inputProps={{ maxLength: 200 }}
          />
        </Grid>
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
            <TextField
              fullWidth required multiline minRows={6} maxRows={20}
              label="Description" placeholder="Provide a detailed description including scope, specifications, and key requirements..."
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              onBlur={() => markTouched('description')}
              error={touched.description && !!errors.description}
              helperText={touched.description && errors.description ? errors.description : `${form.description.length} characters`}
              sx={{ flex: 1 }}
            />
          </Box>
          <Button
            variant="outlined"
            startIcon={<Icon name="Search" />}
            onClick={handleWriteTor}
            disabled={aiLoading || !form.title}
            sx={{ mt: 1 }}
          >
            {aiLoading ? 'Generating TOR...' : 'AI Write TOR'}
          </Button>
        </Grid>
        <Grid item xs={12}>
          <Tooltip title="Explain the business problem this procurement will solve" placement="top">
            <TextField
              fullWidth multiline minRows={2} maxRows={4}
              label="Business Need" placeholder="Why is this procurement needed? What business problem does it address?"
              value={form.businessNeed} onChange={(e) => setForm({ ...form, businessNeed: e.target.value })}
            />
          </Tooltip>
        </Grid>
        <Grid item xs={12}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Attachments</Typography>
          <FileUploader onAttachmentsChange={setFileAttachments} />
        </Grid>
      </Grid>
    </Box>
  );

  const renderBudgetCategory = () => {
    const selectedCurrency = CURRENCIES.find((c) => c.code === form.currency) || CURRENCIES[0];
    return (
    <Box>
      <Typography variant="h6" fontWeight={600} gutterBottom>Budget & Classification</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Set budget and classify your request</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>Currency</InputLabel>
            <Select value={form.currency} label="Currency" onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <MenuItem key={c.code} value={c.code}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{c.symbol}</Typography>
                    <Typography variant="body2">{c.label}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <Tooltip title="Estimated total budget for this procurement (optional)" placement="top">
            <TextField
              fullWidth type="number" label="Budget Estimate"
              placeholder="0.00"
              value={form.budgetEstimate} onChange={(e) => setForm({ ...form, budgetEstimate: e.target.value })}
              error={!!errors.budgetEstimate} helperText={errors.budgetEstimate || 'Leave blank if budget is not yet determined'}
              InputProps={{
                startAdornment: <InputAdornment position="start">{selectedCurrency.symbol}</InputAdornment>,
                endAdornment: <InputAdornment position="end">{form.currency}</InputAdornment>,
              }}
            />
          </Tooltip>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select value={form.category} label="Category" onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <MenuItem value=""><em>Select category...</em></MenuItem>
              {CATEGORIES.map((cat) => <MenuItem key={cat} value={cat}>{cat}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>Optional: Location & Department</Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Property / Location</InputLabel>
            <Select value={form.propertyId} label="Property / Location" onChange={(e) => setForm({ ...form, propertyId: e.target.value, departmentId: '' })} error={!!propertiesError}>
              <MenuItem value=""><em>Not assigned</em></MenuItem>
              {properties.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </Select>
            {propertiesError && <Typography variant="caption" color="error">{propertiesError}</Typography>}
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth disabled={!form.propertyId}>
            <InputLabel>Department</InputLabel>
            <Select value={form.departmentId} label="Department" onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <MenuItem value=""><em>Select department...</em></MenuItem>
              {departments.map((d) => (
                <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <Tooltip title="Why is this procurement necessary? What value does it bring?" placement="top">
            <TextField
              fullWidth multiline minRows={2} maxRows={4}
              label="Justification" placeholder="Why is this needed? What happens if not procured? What value does it bring?"
              value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })}
            />
          </Tooltip>
        </Grid>
      </Grid>
    </Box>
  );
  };

  const renderReview = () => {
    const selectedType = REQUEST_TYPES.find((t) => t.value === form.requestType);
    const sections = [
      { label: 'Request Type', value: `${selectedType?.label} — ${selectedType?.subtitle}`, color: selectedType?.color },
      { label: 'Title', value: form.title || '—' },
      { label: 'Business Need', value: form.businessNeed || '—' },
      { label: 'Category', value: form.category || '—' },
      { label: 'Currency', value: form.currency || 'USD' },
      { label: 'Budget', value: form.budgetEstimate ? `${CURRENCIES.find((c) => c.code === form.currency)?.symbol || '$'}${Number(form.budgetEstimate).toLocaleString()} ${form.currency}` : 'Not specified' },
      { label: 'Justification', value: form.justification || '—' },
    ].filter((s) => s.value !== '—');
    return (
      <Box>
        <Typography variant="h6" fontWeight={600} gutterBottom>Review Your Request</Typography>
        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
          Review everything before submitting. You can save as a draft and come back later, or submit directly for procurement review.
        </Alert>
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
          <Box sx={{ bgcolor: selectedType?.color || 'primary.main', color: 'white', px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip label={form.requestType} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 700 }} />
            <Typography variant="subtitle1" fontWeight={600}>{form.title || 'Untitled Request'}</Typography>
          </Box>
          <CardContent sx={{ p: 0 }}>
            {sections.map((section, idx) => (
              <Box key={section.label} sx={{ px: 3, py: 2, borderBottom: idx < sections.length - 1 ? '1px solid' : 'none', borderColor: 'divider', display: 'flex', gap: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140, fontWeight: 500 }}>{section.label}</Typography>
                <Typography variant="body2" sx={{ flex: 1, ...(section.color ? { color: section.color, fontWeight: 600 } : {}) }}>
                  {section.value}
                </Typography>
              </Box>
            ))}
            {form.description && (
              <Box sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 1 }}>Description</Typography>
                <Box sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 2.5, py: 2, minHeight: 80 }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{form.description}</Typography>
                </Box>
              </Box>
            )}
            {fileAttachments.length > 0 && (
              <Box sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 1 }}>Attachments ({fileAttachments.length})</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {fileAttachments.map((att) => (
                <Box key={att.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 0.5 }}>
                      <Icon name="Description" sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ flex: 1 }}>{att.fileName}</Typography>
                      <Typography variant="caption" color="text.secondary">{(att.fileSize / 1024).toFixed(0)}KB</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    );
  };

  const stepContent = [renderTypeSelection(), renderBasicInfo(), renderBudgetCategory(), renderReview()];

  return (
    <Box>
      <Snackbar open={success} autoHideDuration={2000} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="success" sx={{ width: '100%', borderRadius: 2 }}>
          <Typography variant="body2" fontWeight={600}>Procurement created successfully!</Typography>
          <Typography variant="caption">Redirecting to your new request...</Typography>
        </Alert>
      </Snackbar>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Tooltip title="Back to procurements">
          <IconButton onClick={() => navigate('/procurements')}><Icon name="ArrowBack" /></IconButton>
        </Tooltip>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>New Procurement Request</Typography>
          <Typography variant="body2" color="text.secondary">Step {activeStep + 1} of {STEPS.length}</Typography>
        </Box>
      </Box>

      {apiError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setApiError('')}>{apiError}</Alert>}

      <Box sx={{ mb: 4 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {STEPS.map((label, idx) => {
            const status = getStepStatus(idx);
            return (
              <Step key={label} completed={status === 'completed'}>
                <StepLabel
                  onClick={() => { if (idx < activeStep) { setErrors({}); setTouched({}); setActiveStep(idx); } }}
                  sx={{ cursor: idx < activeStep ? 'pointer' : 'default' }}
                >
                  {label}
                </StepLabel>
              </Step>
            );
          })}
        </Stepper>
      </Box>

      <Collapse in timeout={300}>
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3, minHeight: 300 }}>
          <CardContent sx={{ p: 4 }}>
            {stepContent[activeStep]}
          </CardContent>
        </Card>
      </Collapse>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button onClick={handleBack} disabled={activeStep === 0 || loading} startIcon={<Icon name="ArrowBack" />} sx={{ visibility: activeStep === 0 ? 'hidden' : 'visible' }}>
          Back
        </Button>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {activeStep === STEPS.length - 1 && (
            <Button variant="outlined" startIcon={<Icon name="Save" />} onClick={() => handleSave(false)} disabled={loading || success}>
              Save as Draft
            </Button>
          )}
          {activeStep < STEPS.length - 1 ? (
            <Button variant="contained" onClick={handleNext} endIcon={<Icon name="ArrowForward" />}>
              Continue
            </Button>
          ) : (
            <Button variant="contained" startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Icon name="Send" />} onClick={() => handleSave(true)} disabled={loading || success} sx={{ px: 3 }}>
              {loading ? 'Submitting...' : 'Submit for Review'}
            </Button>
          )}
        </Box>
      </Box>

      {/* AI TOR Dialog */}
      <Dialog open={aiDialogOpen} onClose={() => setAiDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>AI Generated Terms of Reference</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Review the generated TOR below. You can accept it to fill the description field, or close to keep your existing text.
          </Typography>
          <Paper sx={{ p: 2, bgcolor: 'action.hover', maxHeight: 400, overflow: 'auto' }}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem' }}>
              {aiTor}
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAiDialogOpen(false)}>Close</Button>
          <Button variant="contained" onClick={handleAcceptTor}>Accept & Fill Description</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function IconButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Box component="span" onClick={onClick} sx={{ cursor: 'pointer', display: 'inline-flex', p: 1, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' }, transition: 'background 0.15s' }}>
      {children}
    </Box>
  );
}
