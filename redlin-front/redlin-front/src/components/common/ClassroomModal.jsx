import React, { useRef, useState } from 'react';
import { Dialog, IconButton, Box, Typography, Button, TextField, CircularProgress, Alert } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MicIcon from '@mui/icons-material/Mic';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import GearSvg from '../../assets/Gear@1x-0.2s-200px-200px (1).svg';
import { classroomService } from '../../services/api/classroom';

// Create a Classroom Space popup (mirrors the other "add space" popups). Give it
// a title and an optional cover image — the directory card shows that image, or
// the live-transcribe logo on white when no cover is provided.
const ClassroomModal = ({ open, onClose, onImported }) => {
  const fileInputRef = useRef(null);
  const [title, setTitle] = useState('');
  const [cover, setCover] = useState(null); // File
  const [preview, setPreview] = useState(null); // object URL
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const pickCover = (file) => {
    if (!file) return;
    setCover(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  };

  const handleCreate = async () => {
    if (!title.trim() || creating) return;
    setError(null);
    setCreating(true);
    try {
      const session = await classroomService.createSession({ title: title.trim(), language: 'es' });
      if (cover) {
        try { await classroomService.uploadCover(session.id, cover); } catch (e) { console.error('cover upload failed', e); }
      }
      onImported?.();
      onClose();
    } catch (e) {
      console.error('Create classroom failed', e);
      setError(e?.response?.data?.detail || e?.message || 'Failed to create lecture.');
      setCreating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={creating ? undefined : onClose}
      PaperProps={{
        style: { backgroundColor: '#1A2A3A' },
        sx: { width: { xs: '92vw', sm: 520 }, maxWidth: '92vw', borderRadius: '20px', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', overflow: 'hidden', position: 'relative' },
      }}
      slotProps={{ backdrop: { sx: { backgroundColor: 'color-mix(in srgb, var(--color-black) 60%, transparent)' } } }}
    >
      <Box sx={{ position: 'relative', p: { xs: 2.5, md: 3.5 } }}>
        <IconButton aria-label="close" onClick={onClose} size="small" disabled={creating} sx={{ position: 'absolute', right: 12, top: 12, zIndex: 2, color: 'rgba(255,255,255,0.6)', '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-white)' } }}>
          <CloseIcon fontSize="small" />
        </IconButton>

        <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: '14px', background: 'color-mix(in srgb, var(--color-teal) 16%, transparent)', mb: 1.25 }}>
          <MicIcon sx={{ fontSize: 26, color: 'var(--color-teal)' }} />
        </Box>
        <Typography variant="h5" sx={{ mb: 0.5, letterSpacing: 0.2, color: 'var(--color-white)' }}>Create a Lecture</Typography>
        <Typography variant="body2" sx={{ mb: 2, color: 'color-mix(in srgb, var(--color-white) 66%, transparent)' }}>
          Give it a title and, optionally, a cover image for its card. A default logo shows if none is set.
        </Typography>

        <TextField
          fullWidth
          label="Lecture title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={creating}
          autoFocus
          inputProps={{ maxLength: 80 }}
          sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: 'var(--color-white)', backgroundColor: 'color-mix(in srgb, var(--color-white) 4%, transparent)', '& fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 14%, transparent)' }, '&:hover fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 24%, transparent)' }, '&.Mui-focused fieldset': { borderColor: 'var(--color-teal)' } }, '& .MuiInputLabel-root': { color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' } }}
        />

        {/* Cover image picker */}
        <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, border: '1px dashed color-mix(in srgb, var(--color-white) 18%, transparent)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {preview ? (
            <img src={preview} alt="Cover preview" style={{ width: 88, height: 56, objectFit: 'cover', borderRadius: 6, display: 'block', background: '#fff' }} />
          ) : (
            <Box sx={{ width: 88, height: 56, borderRadius: 6, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ImageOutlinedIcon sx={{ color: 'rgba(0,0,0,0.4)' }} />
            </Box>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ color: 'var(--color-white)', fontWeight: 600 }}>{cover ? cover.name : 'Cover image (optional)'}</Typography>
            <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 58%, transparent)' }}>
              If none is set, the live-transcribe logo on white is used.
            </Typography>
          </Box>
          <Button size="small" onClick={() => fileInputRef.current?.click()} disabled={creating} sx={{ borderRadius: 999, px: 2, color: 'var(--color-teal)', border: '1px solid color-mix(in srgb, var(--color-teal) 45%, transparent)', textTransform: 'none', fontWeight: 700 }}>
            {cover ? 'Change' : 'Add image'}
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { pickCover(e.target.files?.[0]); if (fileInputRef.current) fileInputRef.current.value = ''; }} />
        </Box>

        <Button
          variant="contained"
          fullWidth
          onClick={handleCreate}
          disabled={creating || !title.trim()}
          sx={{ borderRadius: '999px', py: 1.15, background: 'var(--color-teal)', color: 'var(--color-navy-deep)', fontWeight: 700, textTransform: 'none', boxShadow: '0 10px 28px color-mix(in srgb, var(--color-teal) 30%, transparent)', '&:hover': { background: 'var(--color-teal-pale)' }, '&.Mui-disabled': { bgcolor: 'color-mix(in srgb, var(--color-white) 8%, transparent)', color: 'color-mix(in srgb, var(--color-white) 36%, transparent)' } }}
        >
          {creating ? 'Creating…' : 'Create lecture'}
        </Button>

        {error && !creating && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: 2, textAlign: 'left' }}>{error}</Alert>
        )}

        {creating && (
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, background: 'color-mix(in srgb, var(--color-navy-800) 96%, transparent)', backdropFilter: 'blur(3px)', borderRadius: '20px' }}>
            <img src={GearSvg} alt="Loading" width={64} height={64} />
            <Typography variant="body1" sx={{ color: 'var(--color-white)', fontWeight: 600 }}>Creating your lecture…</Typography>
            <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>Preparing the lecture</Typography>
            <CircularProgress size={20} sx={{ color: 'var(--color-teal)', mt: 1 }} />
          </Box>
        )}
      </Box>
    </Dialog>
  );
};

export default ClassroomModal;