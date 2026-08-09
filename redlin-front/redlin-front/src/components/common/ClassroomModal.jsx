import React, { useRef, useState } from 'react';
import { Dialog, IconButton, Box, Typography, Button, TextField, CircularProgress, Alert } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MicIcon from '@mui/icons-material/Mic';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import GearSvg from '../../assets/Gear@1x-0.2s-200px-200px (1).svg';
import { classroomService } from '../../services/api/classroom';

// Create a Lecture popup. Visual language matches the "Change cover" modal:
// gradient navy surface, teal/blue corner glows, circular header icon and a
// teal dot-pattern cover drop area.
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
      fullWidth
      maxWidth="sm"
      PaperProps={{
        style: { background: 'linear-gradient(135deg, var(--color-navy-050) 0%, var(--color-navy-200) 48%, var(--color-navy) 100%)' },
        sx: { width: { xs: '92vw', sm: 520 }, maxWidth: '92vw', borderRadius: '20px', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', overflow: 'hidden', position: 'relative' },
      }}
      slotProps={{ backdrop: { sx: { backgroundColor: 'color-mix(in srgb, var(--color-black) 60%, transparent)' } } }}
    >
      {/* teal / blue glows */}
      <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at top left, color-mix(in srgb, var(--color-teal) 18%, transparent), transparent 45%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--color-blue) 20%, transparent), transparent 48%)' }} />

      <Box sx={{ position: 'relative', p: { xs: 2.5, md: 3.5 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--color-teal) 18%, transparent)', color: 'var(--color-teal)' }}>
              <MicIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: 'var(--color-white)', fontWeight: 700, letterSpacing: '-0.01em' }}>Create a Lecture</Typography>
              <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 62%, transparent)' }}>
                Give it a title — a cover image is optional.
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small" disabled={creating} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

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

        {/* Cover drop area — teal dot pattern, matches the Change-cover modal */}
        <Box
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); pickCover(e.dataTransfer?.files?.[0]); }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          sx={{
            border: '1px solid color-mix(in srgb, var(--color-teal) 34%, transparent)',
            borderRadius: '16px',
            p: 3,
            textAlign: 'center',
            backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--color-teal) 13%, transparent) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        >
          {preview ? (
            <>
              <img src={preview} alt="Cover preview" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 10, display: 'block', margin: '0 auto 12px', background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }} />
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Button size="small" onClick={() => fileInputRef.current?.click()} disabled={creating} sx={{ borderRadius: 999, px: 3, color: 'var(--color-white)', border: '1px solid color-mix(in srgb, var(--color-white) 22%, transparent)', textTransform: 'none', fontWeight: 700, '&:hover': { borderColor: 'var(--color-teal)' } }}>
                  Choose different
                </Button>
                <Button size="small" onClick={() => { setCover(null); if (preview) URL.revokeObjectURL(preview); setPreview(null); }} disabled={creating} sx={{ borderRadius: 999, px: 3, color: 'var(--color-danger-soft)', textTransform: 'none', fontWeight: 700 }}>
                  Remove
                </Button>
              </Box>
            </>
          ) : (
            <>
              <Box sx={{ width: 56, height: 56, mx: 'auto', mb: 1.5, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed color-mix(in srgb, var(--color-teal) 45%, transparent)', color: 'var(--color-teal)' }}>
                <ImageOutlinedIcon sx={{ fontSize: 26 }} />
              </Box>
              <Typography variant="body2" sx={{ mb: 0.5, color: 'var(--color-white)', fontWeight: 700 }}>Add a cover image (optional)</Typography>
              <Typography variant="caption" sx={{ display: 'block', mb: 1.5, color: 'color-mix(in srgb, var(--color-white) 62%, transparent)' }}>
                Drag &amp; drop it here, or choose one from your files. If none is set, the live-transcribe logo on white is used.
              </Typography>
              <Button variant="contained" onClick={() => fileInputRef.current?.click()} disabled={creating} sx={{ borderRadius: 999, px: 3, py: 1, background: 'var(--color-teal)', color: 'var(--color-navy-deep)', fontWeight: 700, textTransform: 'none', boxShadow: '0 10px 28px color-mix(in srgb, var(--color-teal) 30%, transparent)', '&:hover': { background: 'var(--color-teal-pale)' } }}>
                Choose file
              </Button>
            </>
          )}
        </Box>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { pickCover(e.target.files?.[0]); if (fileInputRef.current) fileInputRef.current.value = ''; }} />

        <Button
          variant="contained"
          fullWidth
          onClick={handleCreate}
          disabled={creating || !title.trim()}
          sx={{ mt: 2, borderRadius: '999px', py: 1.15, background: 'var(--color-teal)', color: 'var(--color-navy-deep)', fontWeight: 700, textTransform: 'none', boxShadow: '0 10px 28px color-mix(in srgb, var(--color-teal) 30%, transparent)', '&:hover': { background: 'var(--color-teal-pale)' }, '&.Mui-disabled': { bgcolor: 'color-mix(in srgb, var(--color-white) 8%, transparent)', color: 'color-mix(in srgb, var(--color-white) 36%, transparent)' } }}
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