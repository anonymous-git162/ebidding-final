import { Icon } from '../components/Icon';
import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Slider, Alert, Divider, Tabs, Tab, Chip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function EvaluationPage() {
  const { user } = useAuth();
  const [procurements, setProcurements] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [reviews, setReviews] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<string, { score: number; comment: string; criterionScores?: { criteriaIndex: number; score: number }[] }>>({});
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [consolidation, setConsolidation] = useState<any>(null);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState('');
  const [leadComment, setLeadComment] = useState('');
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiDialog, setAiDialog] = useState<{ open: boolean; vendorId: string; vendorName: string; score: number; reasoning: string; breakdown: any }>({ open: false, vendorId: '', vendorName: '', score: 0, reasoning: '', breakdown: null });
  const [criteriaDialog, setCriteriaDialog] = useState(false);
  const [criteriaForm, setCriteriaForm] = useState<{ name: string; weight: number; maxScore: number }[]>([]);

  useEffect(() => {
    api.get('/procurements', { params: { limit: 50 } })
      .then(res => {
        const filtered = (res.data.data || []).filter((p: any) =>
          ['EVALUATION', 'PENDING_APPROVAL', 'AWARD_APPROVED', 'AWARD_ANNOUNCED', 'COMPLETED'].includes(p.status)
        );
        setProcurements(filtered);
      })
      .catch(err => setError(err.response?.data?.message || 'Failed'));
  }, []);

  useEffect(() => {
    if (!selected) { setReviews([]); setSubmissions([]); setConsolidation(null); setCriteria([]); return; }
    setLoading(true);
    Promise.all([
      api.get(`/evaluation/reviews/${selected}`),
      api.get(`/rfq-submissions/procurement/${selected}`),
      api.get(`/evaluation/consolidation/${selected}`).catch(() => ({ data: null })),
      api.get(`/evaluation/${selected}/criteria`),
    ]).then(([reviewsRes, subsRes, consRes, criteriaRes]) => {
      const existingReviews = reviewsRes.data || [];
      const c = criteriaRes.data || [];
      setReviews(existingReviews);
      setSubmissions(subsRes.data || []);
      setConsolidation(consRes.data);
      setCriteria(c.length ? c : [
        { name: 'Price Criteria', weight: 40, maxScore: 100 },
        { name: 'Technical & Quality Criteria', weight: 40, maxScore: 100 },
        { name: 'Service & Delivery Criteria', weight: 10, maxScore: 100 },
        { name: 'Qualifications & Experience Criteria', weight: 10, maxScore: 100 },
      ]);
      const seeded: Record<string, { score: number; comment: string; criterionScores?: { criteriaIndex: number; score: number }[] }> = {};
      for (const r of existingReviews) {
        seeded[r.vendorId] = { score: r.score, comment: r.comment || '', criterionScores: r.criterionScores || undefined };
      }
      setScores(prev => ({ ...prev, ...seeded }));
    }).catch(err => setError(err.response?.data?.message || 'Failed'))
      .finally(() => setLoading(false));
  }, [selected]);

  const submitReview = async (vendorId: string) => {
    const s = scores[vendorId];
    if (!s) return;
    try {
      await api.post('/evaluation/reviews', {
        procurementId: selected, vendorId, score: s.score, comment: s.comment,
        criterionScores: s.criterionScores || undefined,
      });
      const res = await api.get(`/evaluation/reviews/${selected}`);
      setReviews(res.data || []);
      setSuccess('Score submitted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err.response?.data?.message || 'Failed'); }
  };

  const computeWeightedScore = (criterionScores: { criteriaIndex: number; score: number }[]) => {
    if (!criteria.length || !criterionScores.length) return -1;
    const totalWeight = criteria.reduce((sum: number, c: any) => sum + (c.weight || 0), 0);
    if (totalWeight === 0) return -1;
    const weighted = criterionScores.reduce((sum: number, cs: any) => {
      const cr = criteria[cs.criteriaIndex];
      if (!cr) return sum;
      return sum + (cs.score / (cr.maxScore || 100)) * (cr.weight || 0);
    }, 0);
    return Math.round((weighted / totalWeight) * 100);
  };

  const openCriteriaDialog = () => {
    setCriteriaForm(criteria.length ? criteria : [
      { name: 'Price Criteria', weight: 40, maxScore: 100 },
      { name: 'Technical & Quality Criteria', weight: 40, maxScore: 100 },
      { name: 'Service & Delivery Criteria', weight: 10, maxScore: 100 },
      { name: 'Qualifications & Experience Criteria', weight: 10, maxScore: 100 },
    ]);
    setCriteriaDialog(true);
  };

  const saveCriteria = async () => {
    try {
      await api.put(`/evaluation/${selected}/criteria`, { criteria: criteriaForm });
      setCriteria(criteriaForm);
      setCriteriaDialog(false);
    } catch (err: any) { setError(err.response?.data?.message || 'Failed'); }
  };

  const consolidate = async () => {
    try {
      await api.post(`/evaluation/consolidate/${selected}`, { recommendation, leadCommentary: leadComment });
      const res = await api.get(`/evaluation/consolidation/${selected}`);
      setConsolidation(res.data);
    } catch (err: any) { setError(err.response?.data?.message || 'Failed'); }
  };

  const aiScore = async (vendorId: string, vendorName: string, price: number) => {
    if (submissions.length === 0) return;
    setAiLoading(vendorId);
    try {
      const allPrices = submissions.map((s) => Number(s.lastBid ?? s.price));
      const sub = submissions.find((s) => s.vendorId === vendorId);
      const res = await api.post('/ai/score-vendor', {
        vendorName,
        price,
        proposalText: sub?.proposalText || '',
        allVendorPrices: allPrices,
        procurementTitle: procurements.find((p) => p.id === selected)?.title || '',
      });
      setAiDialog({
        open: true,
        vendorId,
        vendorName,
        score: res.data.score,
        reasoning: res.data.reasoning,
        breakdown: res.data.breakdown,
      });
    } catch (err: any) {
      setError('AI scoring failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setAiLoading(null);
    }
  };

  const applyAiScore = async () => {
    const b = aiDialog.breakdown;
    const keys = ['price', 'technicalQuality', 'serviceDelivery', 'qualificationsExperience'];
    if (!criteria.length && b && keys.every(k => k in b)) {
      const defaults = [
        { name: 'Price Criteria', weight: 40, maxScore: 100 },
        { name: 'Technical & Quality Criteria', weight: 40, maxScore: 100 },
        { name: 'Service & Delivery Criteria', weight: 10, maxScore: 100 },
        { name: 'Qualifications & Experience Criteria', weight: 10, maxScore: 100 },
      ];
      try {
        await api.put(`/evaluation/${selected}/criteria`, { criteria: defaults });
        setCriteria(defaults);
      } catch { setError('Failed to save evaluation criteria'); }
    }
    const criterionScores = b && keys.every(k => k in b) ? keys.map((k, i) => ({ criteriaIndex: i, score: b[k].raw ?? 50 })) : undefined;
    setScores(prev => ({ ...prev, [aiDialog.vendorId]: { score: aiDialog.score, comment: `AI: ${aiDialog.reasoning.split('\n')[0]}`, criterionScores } }));
    setAiDialog({ ...aiDialog, open: false });
  };

  const getScoreColor = (score: number, max: number) => {
    const pct = (score / max) * 100;
    if (pct >= 80) return 'success.main';
    if (pct >= 60) return 'warning.main';
    return 'error.main';
  };

  const getScoreBg = (score: number, max: number) => {
    const pct = (score / max) * 100;
    if (pct >= 80) return 'success.50';
    if (pct >= 60) return 'warning.50';
    return 'error.50';
  };

  const parseBreakdownLine = (line: string) => {
    const match = line.match(/(.+?):\s*(\d+)\/(\d+)/);
    if (match) {
      const label = match[1].trim();
      const score = parseInt(match[2]);
      const max = parseInt(match[3]);
      return { label, score, max, color: getScoreColor(score, max), bg: getScoreBg(score, max) };
    }
    return null;
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>Evaluation Queue</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Card elevation={0} sx={{ mb: 3, border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          <FormControl fullWidth>
            <InputLabel id="proc-select-label">Procurement</InputLabel>
            <Select labelId="proc-select-label" label="Procurement" value={selected}
              onChange={(e) => { setSelected(e.target.value); setTab(0); }}>
              <MenuItem value=""><em>Select a procurement...</em></MenuItem>
              {procurements.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.requestNo} - {p.title} [{p.status}]</MenuItem>
              ))}
            </Select>
          </FormControl>
          {procurements.length === 0 && !loading && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              No procurements available for evaluation
            </Typography>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {criteria.length ? `${criteria.length} criteria configured` : 'No evaluation criteria set'}
          </Typography>
          {(user?.role === 'PROCUREMENT' || user?.role === 'LEAD_EVALUATOR' || user?.role === 'ADMIN') && (
            <Button size="small" variant="outlined" startIcon={<Icon name="Edit" />} onClick={openCriteriaDialog}>
              {criteria.length ? 'Edit Criteria' : 'Configure Criteria'}
            </Button>
          )}
        </Box>
      )}
      {selected && (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CardContent>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>Loading...</Typography>
              </Box>
            ) : (
              <Box>
                <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                  <Tab label={`Vendor Scores (${submissions.length})`} />
                  <Tab label={`Reviews (${reviews.length})`} />
                  {user?.role === 'LEAD_EVALUATOR' && <Tab label="Consolidation" />}
                </Tabs>
                <Divider sx={{ my: 2 }} />

                {tab === 0 && (
                  <Box>
                    {submissions.length === 0 ? (
                      <Alert severity="info">No vendor submissions to evaluate yet. Vendors need to submit proposals first.</Alert>
                    ) : (
                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Vendor</TableCell>
                              <TableCell>Price</TableCell>
                              <TableCell>{criteria.length ? 'Per-Criterion Scores' : 'Your Score (0-100)'}</TableCell>
                              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Weighted</TableCell>
                              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Comment</TableCell>
                              <TableCell>Action</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {submissions.map((sub) => {
                              const s = scores[sub.vendorId] || { score: 50, comment: '', criterionScores: criteria.map((_, i) => ({ criteriaIndex: i, score: 50 })) };
                              if (!s.criterionScores && criteria.length) s.criterionScores = criteria.map((_, i) => ({ criteriaIndex: i, score: 50 }));
                              const weighted = s.criterionScores ? computeWeightedScore(s.criterionScores) : s.score;
                              const isScored = reviews.some((r: any) => String(r.vendorId) === String(sub.vendorId));
                              return (
                                <TableRow key={sub.id} sx={isScored ? { bgcolor: 'success.50' } : {}}>
                                  <TableCell>{sub.vendor?.companyName || 'Unknown'}</TableCell>
                                  <TableCell>${Number(sub.lastBid ?? sub.price).toLocaleString()}</TableCell>
                                  <TableCell>
                                    {criteria.length > 0 ? (
                                      <Box sx={{ minWidth: 250 }}>
                                        {criteria.map((cr: any, ci: number) => {
                                          const cs = s.criterionScores?.[ci];
                                          return (
                                            <Box key={ci} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                              <Typography variant="caption" sx={{ minWidth: 80, fontSize: 11 }}>{cr.name}</Typography>
                                              <Slider value={cs?.score || 50} min={0} max={cr.maxScore || 100} step={5}
                                                onChangeCommitted={(_, v) => {
                                                  setScores(prev => {
                                                    const s = prev[sub.vendorId] || { score: 50, comment: '' };
                                                    const css = [...(s.criterionScores || [])];
                                                    css[ci] = { criteriaIndex: ci, score: v as number };
                                                    const newWeighted = computeWeightedScore(css);
                                                    return { ...prev, [sub.vendorId]: { ...s, criterionScores: css, score: newWeighted } };
                                                  });
                                                }}
                                                sx={{ width: 120 }} />
                                              <Typography variant="caption" sx={{ minWidth: 20 }}>{cs?.score || 50}</Typography>
                                            </Box>
                                          );
                                        })}
                                      </Box>
                                    ) : (
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Slider value={s.score} min={0} max={100} step={5}
                                          onChangeCommitted={(_, v) => setScores(prev => ({ ...prev, [sub.vendorId]: { ...prev[sub.vendorId], score: v as number } }))}
                                          sx={{ width: 150 }} />
                                        <Typography variant="body2" sx={{ minWidth: 30 }}>{s.score}</Typography>
                                      </Box>
                                    )}
                                  </TableCell>
                                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                                    <Chip label={weighted} size="small" color={weighted >= 80 ? 'success' : weighted >= 60 ? 'warning' : 'error'} />
                                  </TableCell>
                                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                                    <TextField size="small" multiline rows={5} placeholder="Add comment..."
                                      value={s.comment || ''}
                                      onChange={(e) => setScores(prev => ({ ...prev, [sub.vendorId]: { ...prev[sub.vendorId], comment: e.target.value } }))} />
                                  </TableCell>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                      <Button size="small" variant="outlined" color="secondary"
                                        startIcon={aiLoading === sub.vendorId ? <CircularProgress size={14} /> : <Icon name="Assessment" />}
                                        onClick={() => aiScore(sub.vendorId, sub.vendor?.companyName || 'Unknown', Number(sub.lastBid ?? sub.price))}
                                        disabled={aiLoading !== null}>
                                        {aiLoading === sub.vendorId ? 'Scoring...' : 'AI Score'}
                                      </Button>
                                      <Button size="small" variant="contained" startIcon={<Icon name="Send" />}
                                        onClick={() => submitReview(sub.vendorId)}>Submit</Button>
                                    </Box>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </Box>
                )}

                {tab === 1 && (
                  <Box>
                    {reviews.length === 0 ? (
                      <Alert severity="info">No reviews submitted yet.</Alert>
                    ) : (
                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Evaluator</TableCell>
                              <TableCell>Vendor</TableCell>
                              <TableCell>Score</TableCell>
                              <TableCell>Comment</TableCell>
                              <TableCell>Date</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {reviews.map((r) => (
                              <TableRow key={r.id}>
                                <TableCell>{r.evaluator?.fullName || '-'}</TableCell>
                                <TableCell>{r.vendor?.companyName || '-'}</TableCell>
                                <TableCell><Chip label={r.score} color={r.score >= 80 ? 'success' : r.score >= 60 ? 'warning' : 'error'} size="small" /></TableCell>
                                <TableCell>{r.comment || '-'}</TableCell>
                                <TableCell>{new Date(r.submittedAt).toLocaleDateString()}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </Box>
                )}

                {tab === 2 && user?.role === 'LEAD_EVALUATOR' && (
                  <Box sx={{ maxWidth: 600 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>Lead Evaluator Consolidation</Typography>
                    {consolidation ? (
                      <Box>
                        <Alert severity="success" sx={{ mb: 2 }}>Consolidation submitted</Alert>
                        <Typography><strong>Average Score:</strong> {consolidation.avgScore}</Typography>
                        <Typography><strong>Recommendation:</strong> {consolidation.recommendation}</Typography>
                        <Typography><strong>Commentary:</strong> {consolidation.leadCommentary}</Typography>
                      </Box>
                    ) : (
                      <Box>
                        <TextField fullWidth multiline rows={2} label="Recommendation" value={recommendation}
                          onChange={(e) => setRecommendation(e.target.value)} sx={{ mb: 2 }} />
                        <TextField fullWidth multiline rows={3} label="Lead Commentary" value={leadComment}
                          onChange={(e) => setLeadComment(e.target.value)} sx={{ mb: 2 }} />
                        <Button variant="contained" startIcon={<Icon name="Assessment" />} onClick={consolidate}>
                          Submit Consolidation
                        </Button>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={criteriaDialog} onClose={() => setCriteriaDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Evaluation Criteria</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Define weighted criteria for scoring. Each evaluator will score each criterion per vendor.
          </Typography>
          {criteriaForm.map((cr, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center' }}>
              <TextField size="small" label="Name" value={cr.name} onChange={(e) => {
                const f = [...criteriaForm]; f[i] = { ...f[i], name: e.target.value }; setCriteriaForm(f);
              }} sx={{ flex: 1 }} />
              <TextField size="small" label="Weight" type="number" value={cr.weight} onChange={(e) => {
                const f = [...criteriaForm]; f[i] = { ...f[i], weight: Number(e.target.value) }; setCriteriaForm(f);
              }} sx={{ width: 90 }} inputProps={{ min: 0, max: 100 }} />
              <TextField size="small" label="Max" type="number" value={cr.maxScore} onChange={(e) => {
                const f = [...criteriaForm]; f[i] = { ...f[i], maxScore: Number(e.target.value) }; setCriteriaForm(f);
              }} sx={{ width: 80 }} inputProps={{ min: 1 }} />
              <IconButton size="small" onClick={() => setCriteriaForm(criteriaForm.filter((_, j) => j !== i))}><Icon name="Delete" /></IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<Icon name="Add" />} onClick={() => setCriteriaForm([...criteriaForm, { name: '', weight: 10, maxScore: 100 }])}>Add Criterion</Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCriteriaDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveCriteria} disabled={criteriaForm.some(c => !c.name || c.weight <= 0)}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={aiDialog.open} onClose={() => setAiDialog({ ...aiDialog, open: false })} maxWidth="sm" fullWidth>
        <DialogTitle>AI Scoring Suggestion</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={`Vendor: ${aiDialog.vendorName}`} color="primary" />
            <Chip label={`Suggested Score: ${aiDialog.score}/100`} color={aiDialog.score >= 80 ? 'success' : aiDialog.score >= 60 ? 'warning' : 'error'} sx={{ fontWeight: 700 }} />
          </Box>

          <Typography variant="subtitle2" sx={{ mb: 1 }}>Score Breakdown</Typography>
          <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 2, mb: 2 }}>
            {aiDialog.breakdown ? (
              <>
                {[
                  { key: 'price', label: 'Price Criteria', desc: 'Evaluated automatically by system logic (Objective Evaluation).', subs: ['Total Proposed Price'] },
                  { key: 'technicalQuality', label: 'Technical & Quality Criteria', desc: 'Evaluated by the committee based on proposal documents (Subjective/Expert Evaluation).', subs: ['Functional Compliance', 'Premium Features / Specifications', 'Methodology & Work Plan'] },
                  { key: 'serviceDelivery', label: 'Service & Delivery Criteria', desc: 'Evaluated based on commitment SLAs.', subs: ['Delivery Lead Time', 'Warranty Period', 'After-sales Service & SLA'] },
                  { key: 'qualificationsExperience', label: 'Qualifications & Experience Criteria', desc: 'Evaluated based on vendor profile and corporate credentials.', subs: ['Proven Track Record / Case Studies', 'Team Expertise & Certifications', 'Company Profile & Financial Stability'] },
                ].map((item) => {
                  const b = aiDialog.breakdown[item.key];
                  if (!b) return null;
                  return (
                    <Box key={item.key} sx={{ mb: 1.5, p: 1.5, bgcolor: getScoreBg(b.raw, 100), borderRadius: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{item.label}</Typography>
                        <Chip label={`Wt: ${b.weight}%`} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>Raw: {b.raw}/100</Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, color: getScoreColor(b.raw, 100) }}>Net: {b.net}/{b.weight}</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25, fontStyle: 'italic' }}>
                        {item.desc}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Sub-criteria: {item.subs.join(', ')}
                      </Typography>
                    </Box>
                  );
                })}
              </>
            ) : (
              aiDialog.reasoning.split('\n').filter((l: string) => l.startsWith('  ') || l.startsWith('Score:')).map((line: string, i: number) => {
                const parsed = parseBreakdownLine(line);
                if (parsed) {
                  return (
                    <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, px: 1, mb: 0.5, bgcolor: parsed.bg, borderRadius: 0.5 }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{parsed.label}</Typography>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, color: parsed.color }}>{parsed.score}/{parsed.max}</Typography>
                    </Box>
                  );
                }
                return <Typography key={i} variant="body2" sx={{ fontFamily: 'monospace', py: 0.25, fontWeight: 700 }}>{line}</Typography>;
              })
            )}
          </Box>

          <Typography variant="subtitle2" sx={{ mb: 1 }}>Analysis Details</Typography>
          <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 2 }}>
            {aiDialog.reasoning.split('\n').filter((l: string) => !l.startsWith('  ') && !l.startsWith('Score:') && l.trim()).map((line: string, i: number) => (
              <Typography key={i} variant="body2" sx={{ py: 0.25 }}>{line}</Typography>
            ))}
          </Box>

          <Alert severity="info" sx={{ mt: 2 }}>Scoring formula: Raw Score × Weight = Net Score. Total = sum of all net scores. AI suggestion based on analysis of price, proposal, and market data. Accept or modify manually.</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAiDialog({ ...aiDialog, open: false })}>Cancel</Button>
          <Button variant="contained" startIcon={<Icon name="CheckCircle" />} onClick={applyAiScore}>Apply Score</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
