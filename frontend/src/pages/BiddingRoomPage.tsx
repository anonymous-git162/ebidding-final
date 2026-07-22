import { Icon } from '../components/Icon';
import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Alert, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, Divider, LinearProgress,
} from '@mui/material';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { CURRENCY_MAP } from '../utils/constants';
import FileUploader from '../components/FileUploader';

interface Bid {
  id: string;
  bidAmount: number;
  submittedAt: string;
  vendor?: { id: string; companyName: string };
  vendorId: string;
  files?: Array<{ id: string; fileName: string; fileSize: number }>;
}

interface Round {
  id: string;
  roundNo: number;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  responses: Array<{ vendorId: string; bidAmount: number }>;
}

export default function BiddingRoomPage() {
  const { user } = useAuth();
  const { on, emit } = useSocket();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [roundBids, setRoundBids] = useState<Bid[]>([]);
  const [myBids, setMyBids] = useState<Bid[]>([]);
  const [bidAmount, setBidAmount] = useState('');
  const [procurementId, setProcurementId] = useState('');
  const [procurements, setProcurements] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileAttachments, setFileAttachments] = useState<{ id: string; fileName: string; fileSize: number }[]>([]);
  const [fileUploadKey, setFileUploadKey] = useState(0);

  const getCurrencySymbol = () => {
    const proc = procurements.find(p => p.id === procurementId);
    const code = proc?.currency || 'USD';
    return CURRENCY_MAP[code]?.symbol || '$';
  };

  const getCurrencyCode = () => {
    const proc = procurements.find(p => p.id === procurementId);
    return proc?.currency || 'USD';
  };

  useEffect(() => { loadProcurements(); }, []);
  useEffect(() => { if (procurementId) loadRounds(); }, [procurementId]);
  useEffect(() => { if (selectedRound) loadRoundBids(); }, [selectedRound]);

  // Real-time bid updates via WebSocket
  useEffect(() => {
    if (!selectedRound) return;
    emit('join', { room: `bidding:${selectedRound.id}` });
    const unsub = on('bid:update', () => { loadRoundBids(); });
    return () => {
      unsub();
      emit('leave', { room: `bidding:${selectedRound.id}` });
    };
  }, [selectedRound?.id]);

  const loadProcurements = async () => {
    try {
      const [procRes, invRes] = await Promise.all([
        api.get('/procurements', { params: { limit: 50 } }),
        api.get('/vendor-invitations/my').catch(() => ({ data: [] })),
      ]);

      let list = procRes.data.data || [];
      if (user?.role === 'VENDOR') {
        const acceptedIds = (invRes.data || [])
          .filter((inv: any) => inv.invitationStatus === 'ACCEPTED')
          .map((inv: any) => inv.procurementId);
        list = list.filter((p: any) => acceptedIds.includes(p.id));
      }
      setProcurements(list);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed');
    }
  };

  const loadRounds = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/ebidding/rounds/procurement/${procurementId}`);
      setRounds(res.data || []);
      setSelectedRound(null);
      setRoundBids([]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const loadRoundBids = async () => {
    if (!selectedRound) return;
    try {
      if (user?.role === 'VENDOR') {
        const myRes = await api.get(`/ebidding/rounds/${selectedRound.id}/my-bids`);
        setMyBids(myRes.data || []);
        // Also try to get all bids for lowest-bid validation (may 403 for vendors)
        try {
          const allRes = await api.get(`/ebidding/rounds/${selectedRound.id}/bids`);
          const sorted = (allRes.data || []).sort((a: Bid, b: Bid) => a.bidAmount - b.bidAmount);
          setRoundBids(sorted);
        } catch { setRoundBids([]); }
      } else {
        const allRes = await api.get(`/ebidding/rounds/${selectedRound.id}/bids`);
        const sorted = (allRes.data || []).sort((a: Bid, b: Bid) => a.bidAmount - b.bidAmount);
        setRoundBids(sorted);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load bids');
    }
  };

  const createRound = async () => {
    try {
      await api.post('/ebidding/rounds', { procurementId });
      setDialogOpen(false);
      loadRounds();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed');
    }
  };

  const openRound = async (id: string) => {
    try { await api.post(`/ebidding/rounds/${id}/open`); loadRounds(); } catch (err: any) { setError(err.response?.data?.message || 'Failed to open round'); }
  };

  const closeRound = async (id: string) => {
    try { await api.post(`/ebidding/rounds/${id}/close`); loadRounds(); } catch (err: any) { setError(err.response?.data?.message || 'Failed to close round'); }
  };

  const placeBid = async () => {
    if (!selectedRound || !bidAmount) return;
    try {
      await api.post('/ebidding/bid', { roundId: selectedRound.id, bidAmount: parseFloat(bidAmount), fileIds: fileAttachments.map(a => a.id) });
      setBidAmount('');
      setFileAttachments([]);
      setFileUploadKey(k => k + 1);
      loadRoundBids();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to place bid');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'success';
      case 'CLOSED': return 'error';
      case 'PENDING': return 'warning';
      default: return 'default';
    }
  };

  const getLowestBid = (round: Round) => {
    if (!round.responses || round.responses.length === 0) return null;
    return Math.min(...round.responses.map(r => r.bidAmount));
  };

  const getHighestBid = (round: Round) => {
    if (!round.responses || round.responses.length === 0) return null;
    return Math.max(...round.responses.map(r => r.bidAmount));
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>E-Bidding Room</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Procurement Selector */}
      <Card elevation={0} sx={{ mb: 3, border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField select size="small" label="Select Procurement" value={procurementId} onChange={(e) => setProcurementId(e.target.value)} sx={{ minWidth: 300 }} SelectProps={{ native: true }}>
              <option value="">Select...</option>
              {procurements.map((p) => {
                const biddingOpen = p.status === 'EBIDDING_OPEN';
                const label = biddingOpen ? 'OPEN' : 'CLOSED';
                return <option key={p.id} value={p.id}>{p.requestNo} - {p.title} [{label}]</option>;
              })}
            </TextField>
            {user?.role === 'PROCUREMENT' && procurementId && (() => {
              const p = procurements.find(p => p.id === procurementId);
              return p && !['EVALUATION','PENDING_APPROVAL','RETURNED_FROM_APPROVAL','AWARD_APPROVED','AWARD_ANNOUNCED','COMPLETED','REJECTED','CANCELLED'].includes(p.status);
            })() && (
              <Button variant="contained" startIcon={<Icon name="Add" />} onClick={() => setDialogOpen(true)}>Create Round</Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {procurementId && rounds.length === 0 && !loading && (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}><CardContent><Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>No bidding rounds yet. {user?.role === 'PROCUREMENT' ? 'Create one to get started.' : 'Waiting for procurement to create a round.'}</Typography></CardContent></Card>
      )}

      {/* Rounds Summary Cards */}
      {rounds.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Bidding Rounds ({rounds.length})</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(auto-fill, minmax(280px, 1fr))' }, gap: 2 }}>
            {rounds.map((round) => (
              <Card
                key={round.id}
                elevation={0}
                sx={{
                  border: selectedRound?.id === round.id ? '2px solid' : '1px solid',
                  borderColor: selectedRound?.id === round.id ? 'primary.main' : 'divider',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: 'primary.main' },
                }}
                onClick={() => setSelectedRound(round)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6" fontWeight={700}>Round {round.roundNo}</Typography>
                    <Chip label={round.status} size="small" color={getStatusColor(round.status) as any} />
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1, mt: 1 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Bids</Typography>
                      <Typography variant="body2" fontWeight={600}>{round.responses?.length || 0}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Lowest Bid</Typography>
                      <Typography variant="body2" fontWeight={600} color="success.main">
                        {getLowestBid(round) ? `${getCurrencySymbol()}${getLowestBid(round)!.toLocaleString()}` : '-'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Highest Bid</Typography>
                      <Typography variant="body2" fontWeight={600} color="error.main">
                        {getHighestBid(round) ? `${getCurrencySymbol()}${getHighestBid(round)!.toLocaleString()}` : '-'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Started</Typography>
                      <Typography variant="body2">{round.startsAt ? new Date(round.startsAt).toLocaleDateString() : '-'}</Typography>
                    </Box>
                  </Box>
                  {user?.role === 'PROCUREMENT' && (
                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                      {round.status === 'PENDING' && <Button size="small" variant="contained" color="success" startIcon={<Icon name="PlayArrow" />} onClick={(e) => { e.stopPropagation(); openRound(round.id); }}>Open</Button>}
                      {round.status === 'OPEN' && <Button size="small" variant="outlined" color="error" startIcon={<Icon name="Stop" />} onClick={(e) => { e.stopPropagation(); closeRound(round.id); }}>Close</Button>}
                    </Box>
                  )}
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      )}

      {/* Selected Round Detail */}
      {selectedRound && (
        <Card elevation={0} sx={{ mb: 3, border: '1px solid', borderColor: 'divider' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight={700}>Round {selectedRound.roundNo} Details</Typography>
                <Typography variant="body2" color="text.secondary">
                  Status: {selectedRound.status} | Started: {selectedRound.startsAt ? new Date(selectedRound.startsAt).toLocaleString() : 'Not started'}
                  {selectedRound.endsAt && ` | Ended: ${new Date(selectedRound.endsAt).toLocaleString()}`}
                </Typography>
              </Box>
              <Chip label={selectedRound.status} size="small" color={getStatusColor(selectedRound.status) as any} />
            </Box>
            <Divider sx={{ mb: 2 }} />

            {/* Procurement/Admin View: Show all vendor bids */}
            {user?.role !== 'VENDOR' ? (
              <Box>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Vendor Bids ({roundBids.length})</Typography>
                {roundBids.length === 0 ? (
                  <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>No bids placed yet</Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Rank</TableCell>
                          <TableCell>Vendor</TableCell>
                          <TableCell>Bid Amount</TableCell>
                          <TableCell>Files</TableCell>
                          <TableCell>Submitted</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {roundBids.map((bid, idx) => (
                          <TableRow key={bid.id} sx={{ bgcolor: idx === 0 ? 'success.50' : 'transparent' }}>
                            <TableCell>
                              <Chip label={`#${idx + 1}`} size="small" color={idx === 0 ? 'success' : idx === 1 ? 'warning' : 'default'} />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{bid.vendor?.companyName || 'Unknown'}</TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600} color={idx === 0 ? 'success.main' : 'text.primary'}>
                                {getCurrencySymbol()}{bid.bidAmount.toLocaleString()}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {bid.files?.length > 0 ? bid.files.map((f: any) => (
                                <Button key={f.id} size="small" href={`/api/files/${f.id}`} target="_blank" rel="noopener noreferrer" sx={{ textTransform: 'none', mr: 0.5 }}>
                                  {f.fileName}
                                </Button>
                              )) : <Typography variant="caption" color="text.disabled">—</Typography>}
                            </TableCell>
                            <TableCell>{new Date(bid.submittedAt).toLocaleString()}</TableCell>
                            <TableCell>
                              {idx === 0 && <Chip label="Lowest" size="small" color="success" />}
                              {idx === roundBids.length - 1 && roundBids.length > 1 && <Chip label="Highest" size="small" color="error" />}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            ) : (
              /* Vendor View: Show my bids + place new bid */
              <Box>
                {/* Procurement Details */}
                {selectedRound && (
                  <Box sx={{ p: 2, bgcolor: 'primary.50', borderRadius: 1, mb: 2, border: '1px solid', borderColor: 'primary.200' }}>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Procurement Details</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Budget</Typography>
                        <Typography variant="body2" fontWeight={600}>{getCurrencySymbol()}{procurements.find(p => p.id === procurementId)?.budgetEstimate?.toLocaleString() || 'N/A'} {getCurrencyCode()}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Deadline</Typography>
                        <Typography variant="body2">{procurements.find(p => p.id === procurementId)?.submissionDeadline ? new Date(procurements.find(p => p.id === procurementId)?.submissionDeadline).toLocaleDateString() : 'N/A'}</Typography>
                      </Box>
                    </Box>
                  </Box>
                )}

                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>My Bids ({myBids.length})</Typography>
                {myBids.length > 0 ? (
                  <TableContainer sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Bid Amount</TableCell>
                          <TableCell>Files</TableCell>
                          <TableCell>Submitted</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {myBids.map((bid) => (
                          <TableRow key={bid.id}>
                            <TableCell sx={{ fontWeight: 600 }}>{getCurrencySymbol()}{bid.bidAmount.toLocaleString()}</TableCell>
                            <TableCell>
                              {bid.files?.length > 0 ? bid.files.map((f: any) => (
                                <Button key={f.id} size="small" href={`/api/files/${f.id}`} target="_blank" rel="noopener noreferrer" sx={{ textTransform: 'none', mr: 0.5 }}>
                                  {f.fileName}
                                </Button>
                              )) : <Typography variant="caption" color="text.disabled">—</Typography>}
                            </TableCell>
                            <TableCell>{new Date(bid.submittedAt).toLocaleString()}</TableCell>
                            <TableCell>
                              {selectedRound.status === 'OPEN' ? <Chip label="Active" size="small" color="success" /> : <Chip label="Locked" size="small" />}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography color="text.secondary" sx={{ mb: 2 }}>No bids placed in this round yet</Typography>
                )}

                {selectedRound.status === 'OPEN' && (
                  <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Place New Bid</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      {roundBids.length > 0
                        ? `Enter a bid amount in ${getCurrencyCode()}. Must be less than ${getCurrencySymbol()}${roundBids[0].bidAmount.toLocaleString()} (current lowest).`
                        : `Enter your bid amount in ${getCurrencyCode()}. ${user?.role === 'VENDOR' ? 'Be competitive to win.' : 'No bids placed yet — you are the first bidder.'}`}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                      <TextField label={`Bid Amount (${getCurrencyCode()})`} type="number" size="small" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} sx={{ flex: 1 }} inputProps={{ min: 1 }} />
                      <Button variant="contained" startIcon={<Icon name="Gavel" />} onClick={placeBid} disabled={!bidAmount || parseFloat(bidAmount) <= 0 || (roundBids.length > 0 && parseFloat(bidAmount) >= roundBids[0].bidAmount)}>
                        Submit
                      </Button>
                    </Box>
                    <Box sx={{ mt: 1.5 }}>
                      <FileUploader key={fileUploadKey} onAttachmentsChange={setFileAttachments} />
                    </Box>
                    {roundBids.length > 0 && parseFloat(bidAmount) >= roundBids[0].bidAmount && bidAmount && (
                      <Alert severity="warning" sx={{ mt: 1 }}>Bid must be less than the current lowest bid of {getCurrencySymbol()}{roundBids[0].bidAmount.toLocaleString()}</Alert>
                    )}
                  </Box>
                )}
                {selectedRound.status !== 'OPEN' && (
                  <Alert severity="info" sx={{ mt: 1 }}>Bidding is not open for this round</Alert>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Round Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>Create Bidding Round</DialogTitle>
        <DialogContent>
          <Typography sx={{ mt: 1 }}>Create a new bidding round for this procurement? This will allow invited vendors to place bids.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createRound}>Create Round</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
