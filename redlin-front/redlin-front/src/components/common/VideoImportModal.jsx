import React, { useMemo, useState } from 'react';
import { Dialog, IconButton, Box, Typography, Button, TextField, Select, MenuItem, CircularProgress, Alert } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import GearSvg from '../../assets/Gear@1x-0.2s-200px-200px (1).svg';
import { videoService } from '../../services/api/video';

// Dedicated "Add a Video" popup (no other space options). Paste a YouTube URL,
// optionally choose transcript languages, then "Process video" — an engine
// loader shows while it is created, then the popup closes and the user lands
// back on /videos with the new video listed.
const VideoImportModal = ({ open, onClose, onImported }) => {
  const [url, setUrl] = useState('');
  const [language, setLanguage] = useState('en');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Live URL validation: we can add the video only if it maps to a YouTube id.
  const videoId = useMemo(() => videoService.extractVideoId(url.trim()), [url]);

  const handleProcess = async () => {
    if (processing) return;
    if (!videoId) { setError('Please enter a valid YouTube URL (watch, youtu.be, or shorts).'); return; }
    setError(null);
    setProcessing(true);
    try {
      const langs = [language].filter(Boolean);
      await videoService.createVideo({ url: url.trim(), languages: langs });
      onImported?.();
      onClose();
    } catch (e) {
      console.error('Add video failed', e);
      setError(e?.response?.data?.error || e?.message || 'Failed to add the video. Please try again.');
      setProcessing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={processing ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        style: { background: 'linear-gradient(135deg, var(--color-navy-050) 0%, var(--color-navy-200) 48%, var(--color-navy) 100%)' },
        sx: {
          width: { xs: '92vw', sm: 540 },
          maxWidth: '92vw',
          borderRadius: '20px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          position: 'relative',
        },
      }}
      slotProps={{
        backdrop: { sx: { backgroundColor: 'color-mix(in srgb, var(--color-black) 60%, transparent)' } },
      }}
    >
      {/* teal / blue glows */}
      <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at top left, color-mix(in srgb, var(--color-teal) 18%, transparent), transparent 45%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--color-blue) 20%, transparent), transparent 48%)' }} />

      <Box sx={{ position: 'relative', p: { xs: 2.5, md: 3.5 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--color-teal) 18%, transparent)', color: 'var(--color-teal)' }}>
              <OndemandVideoIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: 'var(--color-white)', fontWeight: 700, letterSpacing: '-0.01em' }}>Add a Video</Typography>
              <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 62%, transparent)' }}>
                Paste a YouTube link and we&apos;ll fetch its transcript, summary, and study items.
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small" disabled={processing} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <TextField
          fullWidth
          label="YouTube URL"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(null); }}
          disabled={processing}
          placeholder="https://www.youtube.com/watch?v=..."
          sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { color: 'var(--color-white)', backgroundColor: 'color-mix(in srgb, var(--color-white) 4%, transparent)', '& fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 14%, transparent)' }, '&:hover fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 24%, transparent)' }, '&.Mui-focused fieldset': { borderColor: 'var(--color-teal)' } }, '& .MuiInputLabel-root': { color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' } }}
        />

        <TextField
          select
          fullWidth
          label="Transcript language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={processing}
          sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: 'var(--color-white)', backgroundColor: 'color-mix(in srgb, var(--color-white) 4%, transparent)', '& fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 14%, transparent)' }, '&:hover fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 24%, transparent)' }, '&.Mui-focused fieldset': { borderColor: 'var(--color-teal)' } }, '& .MuiInputLabel-root': { color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' } }}
        >
          <MenuItem value="en">English (en)</MenuItem>
        </TextField>

        {videoId && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, p: 1.5, borderRadius: 2, border: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)', background: 'color-mix(in srgb, var(--color-white) 3%, transparent)' }}>
            <img
              src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
              alt="Video preview"
              style={{ width: 88, height: 50, objectFit: 'cover', borderRadius: 6, display: 'block', background: '#000' }}
            />
            <Typography variant="body2" sx={{ color: 'var(--color-success)', fontWeight: 600 }}>Valid YouTube video — ready to process.</Typography>
          </Box>
        )}

        <Button
          variant="contained"
          fullWidth
          onClick={handleProcess}
          disabled={processing || !videoId}
          sx={{
            borderRadius: '999px',
            py: 1.15,
            background: 'var(--color-teal)',
            color: 'var(--color-navy-deep)',
            fontWeight: 700,
            textTransform: 'none',
            boxShadow: '0 10px 28px color-mix(in srgb, var(--color-teal) 30%, transparent)',
            '&:hover': { background: 'var(--color-teal-pale)' },
            '&.Mui-disabled': { bgcolor: 'color-mix(in srgb, var(--color-white) 8%, transparent)', color: 'color-mix(in srgb, var(--color-white) 36%, transparent)' },
          }}
        >
          {processing ? 'Adding…' : 'Process video'}
        </Button>

        {error && !processing && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: 2, textAlign: 'left' }}>{error}</Alert>
        )}

        {/* Engine loader — centered over the popup while the video is created */}
        {processing && (
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, background: 'color-mix(in srgb, var(--color-navy-800) 96%, transparent)', backdropFilter: 'blur(3px)', borderRadius: '20px' }}>
            <img src={GearSvg} alt="Loading" width={64} height={64} />
            <Typography variant="body1" sx={{ color: 'var(--color-white)', fontWeight: 600 }}>Adding your video…</Typography>
            <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>Fetching transcript, summary, and study items</Typography>
            <CircularProgress size={20} sx={{ color: 'var(--color-teal)', mt: 1 }} />
          </Box>
        )}
      </Box>
    </Dialog>
  );
};

export default VideoImportModal;
