import { Icon } from '../components/Icon';
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Grid, Card, CardContent, Typography, Button, Divider, TextField, Chip, List,
  ListItem, ListItemText, ListItemIcon, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, Tab, Tabs, Alert, LinearProgress, Avatar, Tooltip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import StatusBadge from '../components/StatusBadge';

const STATUS_FLOW = ['DRAFT','SUBMITTED','UNDER_PROCUREMENT_REVIEW','APPROVED','RFP_PUBLISHED','RFQ_OPEN','VENDOR_RESPONSE_IN_PROGRESS','EBIDDING_PREP','EBIDDING_OPEN','EBIDDING_CLOSED','EVALUATION','PENDING_APPROVAL','AWARD_APPROVED','AWARD_ANNOUNCED','COMPLETED'];

function getStepIndex(status: string) {
  return STATUS_FLOW.indexOf(status);
}

const EVENT_ICONS: Record<string, string> = {
  DRAFT_CREATED: 'Edit', SUBMITTED: 'Send', APPROVED: 'CheckCircle', REJECTED: 'Cancel',
  RETURNED_FOR_REVISION: 'Undo', RFP_PUBLISHED: 'Publish', RFQ_OPEN: 'Publish',
  VENDOR_INVITED: 'Mail', VENDOR_ACCEPTED: 'CheckCircle', SENT_TO_APPROVAL: 'Send',
  RETURNED_FROM_APPROVAL: 'Undo', PENDING_APPROVAL: 'Approval',
};

export default function ProcurementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [procurement, setProcurement] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [tab, setTab] = useState(0);
  const [dialog, setDialog] = useState<{ type: string; title: string } | null>(null);
  const [comment, setComment] = useState('');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (id) loadProcurement(); }, [id]);

  const loadProcurement = async () => {
    try {
      const [pRes, tlRes] = await Promise.all([
        api.get(`/procurements/${id}`),
        api.get(`/timeline/${id}`),
      ]);
      setProcurement(pRes.data);
      setTimeline(tlRes.data || []);

      // Load evaluations if available
      try {
        const evalRes = await api.get(`/evaluation/reviews/${id}`);
        setProcurement((prev: any) => ({ ...prev, evaluations: evalRes.data || [] }));
      } catch { /* no evaluations yet */ }

      // Load consolidation if available
      try {
        const consRes = await api.get(`/evaluation/consolidation/${id}`);
        setProcurement((prev: any) => ({ ...prev, consolidation: consRes.data }));
      } catch { /* no consolidation yet */ }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load procurement');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    setActionLoading(true);
    setError('');
    try {
      if (action === 'submit') await api.post(`/procurements/${id}/submit`);
      else if (action === 'startReview') await api.post(`/procurements/${id}/review/start`);
      else if (action === 'approve') await api.post(`/procurements/${id}/review/approve`, { comment });
      else if (action === 'return') await api.post(`/procurements/${id}/review/return`, { reason: comment });
      else if (action === 'reject') await api.post(`/procurements/${id}/review/reject`, { reason: comment });
      else if (action === 'publish') await api.post(`/procurements/${id}/publish`, { submissionDeadline: deadline || undefined });
      else if (action === 'vendorResponse') await api.post(`/procurements/${id}/vendor-response/complete`);
      else if (action === 'startEbidding') await api.post(`/procurements/${id}/ebidding/start`);
      else if (action === 'completeEbidding') await api.post(`/procurements/${id}/ebidding/complete`);
      else if (action === 'completeEvaluation') await api.post(`/procurements/${id}/evaluation/complete`);
      else if (action === 'announceAward') await api.post(`/procurements/${id}/award/announce`);
      else if (action === 'completeProcurement') await api.post(`/procurements/${id}/award/complete`);
      else if (action === 'cancel') await api.post(`/procurements/${id}/cancel`, { reason: comment });
      setDialog(null);
      setComment('');
      setDeadline('');
      await loadProcurement();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Box sx={{ py: 4 }}><LinearProgress sx={{ borderRadius: 1 }} /><Typography color="text.secondary" sx={{ mt: 2 }}>Loading procurement details...</Typography></Box>;
  if (error && !procurement) return <Alert severity="error" sx={{ m: 3 }}>{error}</Alert>;
  if (!procurement) return <Typography sx={{ m: 3 }}>Procurement not found</Typography>;

  const role = user?.role;
  const status = procurement.status;
  const stepIdx = getStepIndex(status);
  const typeColor = procurement.requestType === 'RFP' ? 'primary.main' : procurement.requestType === 'RFQ' ? 'warning.main' : 'text.secondary';

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Tooltip title="Back to procurements">
          <Box component="span" onClick={() => navigate('/procurements')} sx={{ cursor: 'pointer', display: 'inline-flex', p: 1, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
            <Icon name="ArrowBack" />
          </Box>
        </Tooltip>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Chip label={procurement.requestType} size="small" sx={{ bgcolor: typeColor, color: 'white', fontWeight: 700 }} />
            <Typography variant="h5" fontWeight={700}>{procurement.title}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary">{procurement.requestNo}</Typography>
            <StatusBadge status={status} />
            <Chip label={`${procurement.currentOwnerRole?.replace(/_/g, ' ')}`} size="small" variant="outlined" />
            <Typography variant="caption" color="text.secondary">by {procurement.requester?.fullName}</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {role === 'REQUESTER' && status === 'DRAFT' && (
            <>
              <Button variant="outlined" startIcon={<Icon name="Edit" />} onClick={() => navigate(`/procurements/${id}/edit`)}>Edit</Button>
              <Button variant="contained" startIcon={<Icon name="Send" />} onClick={() => handleAction('submit')}>Submit for Review</Button>
            </>
          )}
          {role === 'PROCUREMENT' && status === 'SUBMITTED' && (
            <Button variant="contained" color="info" startIcon={<Icon name="CheckCircle" />} onClick={() => handleAction('startReview')}>Start Review</Button>
          )}
          {role === 'PROCUREMENT' && status === 'UNDER_PROCUREMENT_REVIEW' && (
            <>
              <Button variant="contained" color="success" startIcon={<Icon name="CheckCircle" />} onClick={() => setDialog({ type: 'approve', title: 'Approve Request' })}>Approve</Button>
              <Button variant="outlined" color="warning" startIcon={<Icon name="Undo" />} onClick={() => setDialog({ type: 'return', title: 'Return for Revision' })}>Return</Button>
              <Button variant="outlined" color="error" startIcon={<Icon name="Cancel" />} onClick={() => setDialog({ type: 'reject', title: 'Reject Request' })}>Reject</Button>
            </>
          )}
          {role === 'PROCUREMENT' && status === 'APPROVED' && (
            <Button variant="contained" startIcon={<Icon name="Publish" />} onClick={() => setDialog({ type: 'publish', title: 'Publish Request' })}>Publish</Button>
          )}
          {role === 'PROCUREMENT' && (status === 'RFP_PUBLISHED' || status === 'RFQ_OPEN') && (
            <Button variant="contained" color="info" startIcon={<Icon name="Send" />} onClick={() => handleAction('vendorResponse')}>Complete Vendor Response</Button>
          )}
          {role === 'PROCUREMENT' && status === 'VENDOR_RESPONSE_IN_PROGRESS' && (
            <Button variant="contained" color="warning" startIcon={<Icon name="Gavel" />} onClick={() => handleAction('startEbidding')}>Start E-Bidding</Button>
          )}
          {role === 'PROCUREMENT' && status === 'EBIDDING_PREP' && (
            <Button variant="contained" color="warning" startIcon={<Icon name="Gavel" />} onClick={() => handleAction('completeEbidding')}>Complete E-Bidding</Button>
          )}
          {role === 'PROCUREMENT' && status === 'VENDOR_RESPONSE_IN_PROGRESS' && (
            <Button variant="outlined" color="info" startIcon={<Icon name="CheckCircle" />} onClick={() => handleAction('completeEbidding')} sx={{ ml: 1 }}>Skip to Evaluation</Button>
          )}
          {role === 'PROCUREMENT' && status === 'EVALUATION' && (
            <Button variant="contained" color="info" startIcon={<Icon name="CheckCircle" />} onClick={() => handleAction('completeEvaluation')}>Complete Evaluation</Button>
          )}
          {(role === 'APPROVER' || role === 'ADMIN') && status === 'PENDING_APPROVAL' && (
            <>
              <Button variant="contained" color="success" startIcon={<Icon name="Approval" />} onClick={() => setDialog({ type: 'approve', title: 'Approve Award' })}>Approve</Button>
              <Button variant="outlined" color="warning" startIcon={<Icon name="Undo" />} onClick={() => setDialog({ type: 'return', title: 'Return for Revision' })}>Return</Button>
              <Button variant="outlined" color="error" startIcon={<Icon name="Cancel" />} onClick={() => setDialog({ type: 'reject', title: 'Reject' })}>Reject</Button>
            </>
          )}
          {role === 'PROCUREMENT' && status === 'AWARD_APPROVED' && (
            <Button variant="contained" color="success" startIcon={<Icon name="Publish" />} onClick={() => handleAction('announceAward')}>Announce Award</Button>
          )}
          {role === 'PROCUREMENT' && status === 'AWARD_ANNOUNCED' && (
            <Button variant="contained" color="success" startIcon={<Icon name="CheckCircle" />} onClick={() => handleAction('completeProcurement')}>Complete</Button>
          )}
        </Box>
      </Box>

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3, overflow: 'hidden' }}>
        <Box sx={{ px: 3, py: 1.5, bgcolor: 'action.hover', borderBottom: '1px solid #E5E7EB' }}>
          <Typography variant="subtitle2" fontWeight={600} color="text.secondary">Workflow Progress</Typography>
        </Box>
        <CardContent sx={{ py: 2, px: 2 }}>
          <Box sx={{ display: 'flex', gap: 0, overflowX: 'auto', pb: 0.5 }}>
            {STATUS_FLOW.map((s, idx) => {
              const isComplete = idx < stepIdx;
              const isCurrent = idx === stepIdx;
              return (
                <React.Fragment key={s}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44, flexShrink: 0 }}>
                    <Box sx={{
                      width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.25,
                      bgcolor: isComplete ? 'success.main' : isCurrent ? typeColor : 'action.disabled',
                      color: isComplete || isCurrent ? 'white' : 'text.disabled',
                    }}>
                      {isComplete ? <Icon name="CheckCircle" /> : <Typography variant="caption" fontWeight={700} sx={{ fontSize: 8 }}>{idx + 1}</Typography>}
                    </Box>
                    <Typography variant="caption" sx={{ fontSize: 7, textAlign: 'center', color: isCurrent ? 'text.primary' : 'text.secondary', fontWeight: isCurrent ? 600 : 400, lineHeight: 1.1, maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Typography>
                  </Box>
                  {idx < STATUS_FLOW.length - 1 && (
                    <Box sx={{ flex: 1, minWidth: 6, display: 'flex', alignItems: 'center', pt: 0 }}>
                      <Box sx={{ width: '100%', height: 2, bgcolor: isComplete ? 'success.main' : 'action.disabled', borderRadius: 1 }} />
                    </Box>
                  )}
                </React.Fragment>
              );
            })}
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
            <Box sx={{ borderBottom: '1px solid #E5E7EB' }}>
              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, '& .MuiTab-root': { textTransform: 'none', fontWeight: 500 } }}>
                <Tab label="Overview" />
                <Tab label="Vendors" />
                <Tab label="Submissions" />
                <Tab label="Evaluation" />
              </Tabs>
            </Box>

            <CardContent sx={{ p: 3 }}>
              {tab === 0 && (
                <Box>
                  {procurement.description && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" fontWeight={600} color="text.secondary" gutterBottom>Description</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{procurement.description}</Typography>
                    </Box>
                  )}
                  {procurement.businessNeed && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" fontWeight={600} color="text.secondary" gutterBottom>Business Need</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{procurement.businessNeed}</Typography>
                    </Box>
                  )}
                  {procurement.justification && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" fontWeight={600} color="text.secondary" gutterBottom>Justification</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{procurement.justification}</Typography>
                    </Box>
                  )}
                  {procurement.files && procurement.files.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" fontWeight={600} color="text.secondary" gutterBottom>Attachments ({procurement.files.length})</Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {procurement.files.map((file: any) => (
                          <Box key={file.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 2, py: 1 }}>
                            <Icon name="Description" sx={{ fontSize: 20, color: 'text.secondary' }} />
                            <Typography variant="body2" sx={{ flex: 1 }}>{file.fileName}</Typography>
                            <Typography variant="caption" color="text.secondary">{(file.fileSize / 1024).toFixed(0)}KB</Typography>
                            <Button size="small" href={`/api/files/${file.id}`} target="_blank" startIcon={<Icon name="Download" />}>Download</Button>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}
                  <Divider sx={{ my: 2 }} />
                  <Grid container spacing={2}>
                    {[
                      ['Property', procurement.property?.name, 'People'],
                      ['Category', procurement.category, 'Assignment'],
                      ['Budget', procurement.budgetEstimate ? `$${Number(procurement.budgetEstimate).toLocaleString()}` : 'Not specified', 'Assessment'],
                      ['Invitations', `${procurement._count?.invitations || 0} vendors`, 'Mail'],
                      ['Submissions', `${procurement._count?.submissions || 0} received`, 'Send'],
                      ['Current Owner', procurement.currentOwnerRole?.replace(/_/g, ' '), 'Person'],
                    ].map(([label, value, icon]) => (
                      <Grid item xs={4} sm={3} key={label}>
                        <Paper elevation={0} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Icon name={icon as string} />
                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                          </Box>
                          <Typography variant="body2" fontWeight={500}>{value || '—'}</Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {tab === 1 && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 2 }}>Invited Vendors</Typography>
                  {(!procurement.invitations || procurement.invitations.length === 0) ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Icon name="Mail" />
                      <Typography color="text.secondary" sx={{ mt: 1 }}>No vendors invited yet</Typography>
                    </Box>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Company</TableCell>
                            <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Invited</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {procurement.invitations.map((inv: any) => (
                            <TableRow key={inv.id}>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Avatar sx={{ width: 28, height: 28, bgcolor: typeColor, fontSize: 11 }}>{inv.vendor?.companyName?.charAt(0)}</Avatar>
                                  <Typography variant="body2" fontWeight={500}>{inv.vendor?.companyName}</Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Chip label={inv.invitationStatus} size="small" color={inv.invitationStatus === 'ACCEPTED' ? 'success' : inv.invitationStatus === 'DECLINED' ? 'error' : 'default'} />
                              </TableCell>
                              <TableCell><Typography variant="caption" color="text.secondary">{new Date(inv.invitedAt).toLocaleDateString()}</Typography></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}

              {tab === 2 && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight={600} color="text.secondary">Vendor Submissions</Typography>
                    {procurement.submissions && procurement.submissions.length > 0 && (
                      <Button size="small" variant="outlined" startIcon={<Icon name="Save" />} onClick={() => {
                        const rows = [['Vendor', 'Price', 'Status', 'Submitted']];
                        (procurement.submissions || []).forEach((sub: any) => {
                          rows.push([
                            sub.vendor?.companyName || '',
                            String(sub.price),
                            sub.status || '',
                            new Date(sub.submittedAt || sub.createdAt).toLocaleDateString(),
                          ]);
                        });
                        const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = `submissions-${procurement.requestNo}.csv`; a.click();
                        URL.revokeObjectURL(url);
                      }}>
                        Export CSV
                      </Button>
                    )}
                  </Box>
                  {(!procurement.submissions || procurement.submissions.length === 0) ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Icon name="Send" />
                      <Typography color="text.secondary" sx={{ mt: 1 }}>Submissions will appear here once vendors respond</Typography>
                    </Box>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Vendor</TableCell>
                            <TableCell>Price</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Submitted</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(procurement.submissions || []).map((sub: any) => (
                            <TableRow key={sub.id}>
                              <TableCell>{sub.vendor?.companyName || '—'}</TableCell>
                              <TableCell>${Number(sub.price).toLocaleString()}</TableCell>
                              <TableCell>{sub.status}</TableCell>
                              <TableCell>{new Date(sub.submittedAt || sub.createdAt).toLocaleDateString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}

              {tab === 3 && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight={600} color="text.secondary">Evaluation Results</Typography>
                    {procurement.evaluations && procurement.evaluations.length > 0 && (
                      <Button size="small" variant="outlined" startIcon={<Icon name="Save" />} onClick={() => {
                        const rows = [['Evaluator', 'Vendor', 'Score', 'Comment', 'Submitted']];
                        (procurement.evaluations || []).forEach((e: any) => {
                          rows.push([
                            e.evaluator?.fullName || '',
                            e.vendor?.companyName || '',
                            String(e.score),
                            e.comment || '',
                            new Date(e.submittedAt).toLocaleString(),
                          ]);
                        });
                        const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = `evaluations-${procurement.requestNo}.csv`; a.click();
                        URL.revokeObjectURL(url);
                      }}>
                        Export CSV
                      </Button>
                    )}
                  </Box>

                  {procurement.consolidation && (
                    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 2, bgcolor: 'success.50' }}>
                      <CardContent sx={{ py: 2 }}>
                        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>Lead Evaluator Recommendation</Typography>
                        <Typography variant="body2">{procurement.consolidation.recommendation}</Typography>
                        {procurement.consolidation.avgScore && (
                          <Chip label={`Avg Score: ${procurement.consolidation.avgScore}`} size="small" color="success" sx={{ mt: 1 }} />
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {(!procurement.evaluations || procurement.evaluations.length === 0) ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Icon name="Assessment" />
                      <Typography color="text.secondary" sx={{ mt: 1 }}>Evaluation results will appear here after scoring</Typography>
                    </Box>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Evaluator</TableCell>
                            <TableCell>Vendor</TableCell>
                            <TableCell>Score</TableCell>
                            <TableCell>Comment</TableCell>
                            <TableCell>Submitted</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {procurement.evaluations.map((e: any) => (
                            <TableRow key={e.id}>
                              <TableCell>{e.evaluator?.fullName || '—'}</TableCell>
                              <TableCell>{e.vendor?.companyName || '—'}</TableCell>
                              <TableCell>
                                <Chip label={e.score} size="small" color={e.score >= 80 ? 'success' : e.score >= 60 ? 'warning' : 'error'} />
                              </TableCell>
                              <TableCell>{e.comment || '—'}</TableCell>
                              <TableCell>{new Date(e.submittedAt).toLocaleDateString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
            <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #E5E7EB' }}>
              <Typography variant="subtitle2" fontWeight={600}>Timeline</Typography>
              <Typography variant="caption" color="text.secondary">{timeline.length} event{timeline.length !== 1 ? 's' : ''}</Typography>
            </Box>
            <CardContent sx={{ p: 0, maxHeight: 400, overflow: 'auto' }}>
              {timeline.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Icon name="Timeline" />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No events yet</Typography>
                </Box>
              ) : (
                <List dense disablePadding>
                  {timeline.map((event: any, idx: number) => (
                    <ListItem key={event.id} sx={{ px: 3, py: 1.5, borderBottom: idx < timeline.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: 'info.50', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name={EVENT_ICONS[event.eventType] || 'Timeline'} />
                        </Box>
                      </ListItemIcon>
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight={500}>{event.eventType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</Typography>}
                        secondary={<Typography variant="caption" color="text.secondary">{event.actorRole} | {new Date(event.timestamp).toLocaleString()}</Typography>}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={!!dialog} onClose={() => setDialog(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 600 }}>{dialog?.title}</DialogTitle>
        <DialogContent>
          {dialog?.type === 'publish' ? (
            <Box>
              <Alert severity="info" sx={{ mb: 2, borderRadius: 1 }}>Set a deadline for vendor submissions. This will make the request visible to invited vendors.</Alert>
              <Alert severity="warning" sx={{ mb: 1, borderRadius: 1 }}>Deadline must be at least 7 days from today.</Alert>
              <TextField fullWidth label="Submission Deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} InputLabelProps={{ shrink: true }} required error={deadline !== '' && new Date(deadline) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)} helperText={deadline !== '' && new Date(deadline) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) ? 'Deadline must be at least 7 days from today' : ''} />
            </Box>
          ) : dialog?.type === 'approve' ? (
            <TextField fullWidth multiline rows={3} label="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add any notes about this approval..." />
          ) : (
            <Box>
              <Alert severity={dialog?.type === 'reject' ? 'error' : 'warning'} sx={{ mb: 2, borderRadius: 1 }}>
                {dialog?.type === 'reject' ? 'This will reject the procurement request.' : 'This will return the request to the requester for changes.'}
              </Alert>
              <TextField fullWidth multiline rows={3} label="Reason *" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Provide a reason..." required />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialog(null)} disabled={actionLoading}>Cancel</Button>
          <Button
            variant="contained" onClick={() => handleAction(dialog!.type)} disabled={actionLoading || (dialog?.type === 'publish' && (!deadline || new Date(deadline) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))) || (dialog?.type !== 'approve' && dialog?.type !== 'publish' && !comment)}
            color={dialog?.type === 'reject' ? 'error' : dialog?.type === 'approve' ? 'success' : 'primary'}
            startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {actionLoading ? 'Processing...' : dialog?.type === 'approve' ? 'Approve' : dialog?.type === 'reject' ? 'Reject' : dialog?.type === 'publish' ? 'Publish' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
