import React, { useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, List, ListItem, ListItemIcon, ListItemText,
  Divider, Alert, Button,
} from '@mui/material';
import api from '../services/api';
import { Icon } from '../components/Icon';

export default function AuditPage() {
  const [inputValue, setInputValue] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  const loadLogs = useCallback(async () => {
    if (!inputValue.trim()) return;
    setSearching(true);
    setError('');
    setLogs([]);
    setSearched(false);
    try {
      const trimmed = inputValue.trim();
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);

      let res;
      if (isUUID) {
        res = await api.get(`/audit/${trimmed}`);
      } else {
        const procRes = await api.get('/procurements', { params: { search: trimmed, limit: 1 } });
        if (procRes.data.data && procRes.data.data.length > 0) {
          const procId = procRes.data.data[0].id;
          res = await api.get(`/audit/${procId}`);
        } else {
          throw new Error(`No procurement found matching "${trimmed}"`);
        }
      }
      setLogs(res.data.data || []);
      setSearched(true);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load audit logs');
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }, [inputValue]);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>Audit Logs</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
            <TextField fullWidth label="Procurement ID" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Enter procurement UUID" />
            <Button variant="contained" onClick={loadLogs} disabled={!inputValue.trim() || searching}>
              {searching ? 'Searching...' : 'Search'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {searched && logs.length === 0 && !error && (
        <Card><CardContent><Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>No audit logs found for this procurement</Typography></CardContent></Card>
      )}

      {logs.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Audit Trail ({logs.length} events)</Typography>
            <List>
              {logs.map((log) => (
                <React.Fragment key={log.id}>
                  <ListItem>
                    <ListItemIcon><Icon name="History" /></ListItemIcon>
                    <ListItemText
                      primary={`${log.action} by ${log.actorRole || 'System'}`}
                      secondary={`${log.entityType} | ${new Date(log.createdAt).toLocaleString()}`}
                    />
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
