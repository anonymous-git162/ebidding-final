import { useRef, useState } from 'react';
import { Box, Button, Typography, CircularProgress, Alert } from '@mui/material';
import { Icon } from './Icon';
import api from '../services/api';

export interface FileAttach {
  id: string;
  fileName: string;
  fileSize: number;
}

interface FileUploaderProps {
  onAttachmentsChange: (attachments: FileAttach[]) => void;
  initialAttachments?: FileAttach[];
}

export default function FileUploader({ onAttachmentsChange, initialAttachments }: FileUploaderProps) {
  const [attachments, setAttachments] = useState<FileAttach[]>(initialAttachments ?? []);
  const [uploading, setUploading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const next = [...attachments, { id: res.data.id, fileName: res.data.fileName, fileSize: res.data.fileSize }];
      setAttachments(next);
      onAttachmentsChange(next);
    } catch {
      /* ignore */
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async (id: string) => {
    setDeleteError('');
    try {
      await api.delete(`/files/${id}`);
      const next = attachments.filter(a => a.id !== id);
      setAttachments(next);
      onAttachmentsChange(next);
    } catch {
      setDeleteError('Failed to delete file');
      setTimeout(() => setDeleteError(''), 3000);
    }
  };

  return (
    <Box>
      {deleteError && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setDeleteError('')}>{deleteError}</Alert>}
      <input ref={fileInputRef} type="file" hidden onChange={handleFileUpload} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button
          variant="outlined" size="small"
          startIcon={uploading ? <CircularProgress size={16} /> : <Icon name="AttachFile" />}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Uploading...' : 'Attach File'}
        </Button>
        <Typography variant="caption" color="text.secondary">Max 10MB</Typography>
      </Box>
      {attachments.length > 0 && (
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {attachments.map(att => (
            <Box key={att.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 0.5 }}>
              <Icon name="Description" sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" sx={{ flex: 1 }}>{att.fileName}</Typography>
              <Typography variant="caption" color="text.secondary">{(att.fileSize / 1024).toFixed(0)}KB</Typography>
              <Button size="small" color="error" onClick={() => handleRemove(att.id)} sx={{ minWidth: 0, p: 0 }}>
                <Icon name="Close" sx={{ fontSize: 16 }} />
              </Button>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
