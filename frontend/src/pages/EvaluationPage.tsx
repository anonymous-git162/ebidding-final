import { Icon } from '../components/Icon';
import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Slider, Alert, Divider, Tabs, Tab, Chip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function EvaluationPage() {
  const { user } = useAuth();
  const [procurements, setProcurements] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [reviews, setReviews] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<string, { score: number; comment: string }>>({});
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [consolidation, setConsolidation] = useState<any>(null);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState('');
  const [leadComment, setLeadComment] = useState('');
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiDialog, setAiDialog] = useState<{ open: boolean; vendorId: string; vendorName: string; score: number; reasoning: string; breakdown: any }>({ open: false, vendorId: '', vendorName: '', score: 0, reasoning: '', breakdown: null });

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
    if (!selected) { setReviews([]); setSubmissions([]); setConsolidation(null); return; }
    setLoading(true);
    Promise.all([
      api.get(`/evaluation/reviews/${selected}`),
      api.get(`/rfq-submissions/procurement/${selected}`),
      api.get(`/evaluation/consolidation/${selected}`).catch(() => ({ data: null })),
    ]).then(([reviewsRes, subsRes, consRes]) => {
      const existingReviews = reviewsRes.data || [];
      setReviews(existingReviews);
      setSubmissions(subsRes.data || []);
      setConsolidation(consRes.data);
      // Pre-populate scores from existing reviews
      const seeded: Record<string, { score: number; comment: string }> = {};
      for (const r of existingReviews) {
        seeded[r.vendorId] = { score: r.score, comment: r.comment || '' };
      }
      setScores(prev => ({ ...prev, ...seeded }));
    }).catch(err => setError(err.response?.data?.message || 'Failed'))
      .finally(() => setLoading(false));
  }, [selected]);

  const submitReview = async (vendorId: string) => {
    const s = scores[vendorId];
    if (!s) return;
    try {
      await api.post('/evaluation/reviews', { procurementId: selected, vendorId, score: s.score, comment: s.comment });
      const res = await api.get(`/evaluation/reviews/${selected}`);
      setReviews(res.data || []);
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
      const allPrices = submissions.map((s) => Number(s.price));
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

  const applyAiScore = () => {
    setScores({ ...scores, [aiDialog.vendorId]: { score: aiDialog.score, comment: `AI: ${aiDialog.reasoning.split('\n')[0]}` } });
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
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>Evaluation Queue</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField select fullWidth size="small" label="Select Procurement" value={selected}
            onChange={(e) => { setSelected(e.target.value); setTab(0); }}
            SelectProps={{ native: true }}>
            <option value="">Select a procurement...</option>
            {procurements.map((p) => (
              <option key={p.id} value={p.id}>{p.requestNo} - {p.title} [{p.status}]</option>
            ))}
          </TextField>
          {procurements.length === 0 && !loading && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              No procurements available for evaluation
            </Typography>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
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
                              <TableCell>Your Score (0-100)</TableCell>
                              <TableCell>Comment</TableCell>
                              <TableCell>Action</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {submissions.map((sub) => (
                              <TableRow key={sub.id}>
                                <TableCell>{sub.vendor?.companyName || 'Unknown'}</TableCell>
                                <TableCell>${Number(sub.price).toLocaleString()}</TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Slider value={scores[sub.vendorId]?.score || 50} min={0} max={100} step={5}
                                      onChange={(_, v) => setScores({ ...scores, [sub.vendorId]: { score: v as number, comment: scores[sub.vendorId]?.comment || '' } })}
                                      sx={{ width: 150 }} />
                                    <Typography variant="body2" sx={{ minWidth: 30 }}>{scores[sub.vendorId]?.score || 50}</Typography>
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <TextField size="small" placeholder="Add comment..."
                                    value={scores[sub.vendorId]?.comment || ''}
                                    onChange={(e) => setScores({ ...scores, [sub.vendorId]: { score: scores[sub.vendorId]?.score || 50, comment: e.target.value } })} />
                                </TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button size="small" variant="outlined" color="secondary"
                                      startIcon={aiLoading === sub.vendorId ? <CircularProgress size={14} /> : <Icon name="Assessment" />}
                                      onClick={() => aiScore(sub.vendorId, sub.vendor?.companyName || 'Unknown', Number(sub.price))}
                                      disabled={aiLoading !== null}>
                                      {aiLoading === sub.vendorId ? 'Scoring...' : 'AI Score'}
                                    </Button>
                                    <Button size="small" variant="contained" startIcon={<Icon name="Send" />}
                                      onClick={() => submitReview(sub.vendorId)}>Submit</Button>
                                  </Box>
                                </TableCell>
                              </TableRow>
                            ))}
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
                  { label: 'Price Competitiveness', score: aiDialog.breakdown.priceCompetitiveness, max: 40 },
                  { label: 'Market Position', score: aiDialog.breakdown.marketPosition, max: 20 },
                  { label: 'Completeness', score: aiDialog.breakdown.completeness, max: 20 },
                  { label: 'Base Quality', score: aiDialog.breakdown.baseQuality, max: 20 },
                ].map((item, i) => (
                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, px: 1, mb: 0.5, bgcolor: getScoreBg(item.score, item.max), borderRadius: 0.5 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{item.label}</Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, color: getScoreColor(item.score, item.max) }}>{item.score}/{item.max}</Typography>
                  </Box>
                ))}
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

          <Alert severity="info" sx={{ mt: 2 }}>AI suggestion based on price analysis. Accept or modify manually.</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAiDialog({ ...aiDialog, open: false })}>Cancel</Button>
          <Button variant="contained" startIcon={<Icon name="CheckCircle" />} onClick={applyAiScore}>Apply Score</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
