import React, { useMemo, useRef, useState } from 'react';
import { Dialog, IconButton, Box, Typography, Button, TextField, Select, MenuItem, CircularProgress, Alert, Tabs, Tab } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import GearSvg from '../../assets/Gear@1x-0.2s-200px-200px (1).svg';
import { videoService } from '../../services/api/video';

// Helper: readable file size (KB / MB).
const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Dedicated "Add a Video" popup (no other space options). Two ways in:
//   1. Paste a YouTube URL, optionally choose transcript languages → "Process video".
//   2. Upload a local MP4 file → the backend transcribes it with Whisper and
//      generates the same summary / MCQs / clozes / Feynman content.
// An engine loader shows while it is created, then the popup closes and the user
// lands back on /videos with the new video listed (status polls as it processes).
const VideoImportModal = ({ open, onClose, onImported }) => {
  const [mode, setMode] = useState('url'); // 'url' | 'upload'
  const [url, setUrl] = useState('');
  const [language, setLanguage] = useState('en');
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

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

  const handleUpload = async () => {
    if (processing) return;
    if (!file) { setError('Please choose a video file to upload.'); return; }
    setError(null);
    setProcessing(true);
    try {
      await videoService.uploadVideo(file);
      onImported?.();
      onClose();
    } catch (e) {
      console.error('Upload video failed', e);
      setError(e?.response?.data?.error || e?.message || 'Failed to upload the video. Please try again.');
      setProcessing(false);
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setError(null);
  };

  const switchMode = (_, v) => {
    setMode(v);
    setError(null);
  };

  const tabSx = {
    textTransform: 'none',
    borderRadius: '999px',
    minHeight: 38,
    px: 2,
    flex: 1,
    color: 'color-mix(in srgb, var(--color-white) 58%, transparent)',
    background: 'color-mix(in srgb, var(--color-white) 4%, transparent)',
    fontSize: '0.875rem',
    fontWeight: 600,
    '&.Mui-selected': {
      color: 'var(--color-navy-deep)',
      background: 'var(--color-teal)',
      fontWeight: 700,
    },
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
                Add a YouTube link or upload an MP4 to generate transcript, summary, and study items.
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small" disabled={processing} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Mode switch */}
        <Tabs
          value={mode}
          onChange={switchMode}
          sx={{
            mb: 2,
            minHeight: 38,
            '& .MuiTabs-indicator': { display: 'none' },
            '& .MuiTabs-flexContainer': { gap: 0.75 },
          }}
        >
          <Tab value="url" label="YouTube URL" disableRipple sx={tabSx} />
          <Tab value="upload" label="Upload MP4" disableRipple sx={tabSx} />
        </Tabs>

        {mode === 'url' ? (
          <>
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
          </>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/*,.mp4,.mov,.m4v,.webm,.mkv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              disabled={processing}
            />

            <Box
              onClick={() => { if (!processing) fileInputRef.current?.click(); }}
              sx={{
                border: '1.5px dashed color-mix(in srgb, var(--color-teal) 45%, transparent)',
                borderRadius: 3,
                p: 3,
                mb: 1.5,
                textAlign: 'center',
                cursor: processing ? 'default' : 'pointer',
                background: 'color-mix(in srgb, var(--color-teal) 6%, transparent)',
                transition: 'border-color .2s, background .2s',
                '&:hover': processing ? {} : { borderColor: 'var(--color-teal)', background: 'color-mix(in srgb, var(--color-teal) 10%, transparent)' },
              }}
            >
              {file ? (
                <>
                  <CloudUploadIcon sx={{ fontSize: 36, color: 'var(--color-teal)', mb: 1 }} />
                  <Typography variant="body1" sx={{ color: 'var(--color-white)', fontWeight: 600, wordBreak: 'break-all' }}>{file.name}</Typography>
                  <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>{formatSize(file.size)} · click to choose a different file</Typography>
                </>
              ) : (
                <>
                  <CloudUploadIcon sx={{ fontSize: 40, color: 'var(--color-teal)', mb: 1 }} />
                  <Typography variant="body1" sx={{ color: 'var(--color-white)', fontWeight: 600 }}>Click to choose a video file</Typography>
                  <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>
                    MP4, MOV, WebM, or MKV — we&apos;ll transcribe the audio and build the same study items.
                  </Typography>
                </>
              )}
            </Box>

            <Typography variant="caption" sx={{ display: 'block', mb: 2, color: 'color-mix(in srgb, var(--color-white) 50%, transparent)' }}>
              Longer files take a few minutes to transcribe and process.
            </Typography>

            <Button
              variant="contained"
              fullWidth
              onClick={handleUpload}
              disabled={processing || !file}
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
              {processing ? 'Uploading…' : 'Upload video'}
            </Button>
          </>
        )}

        {error && !processing && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: 2, textAlign: 'left' }}>{error}</Alert>
        )}

        {/* Engine loader — centered over the popup while the video is created */}
        {processing && (
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, background: 'color-mix(in srgb, var(--color-navy-800) 96%, transparent)', backdropFilter: 'blur(3px)', borderRadius: '20px' }}>
            <img src={GearSvg} alt="Loading" width={64} height={64} />
            <Typography variant="body1" sx={{ color: 'var(--color-white)', fontWeight: 600 }}>
              {mode === 'upload' ? 'Uploading your video…' : 'Adding your video…'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>
              {mode === 'upload' ? 'Transcribing audio and generating study items' : 'Fetching transcript, summary, and study items'}
            </Typography>
            <CircularProgress size={20} sx={{ color: 'var(--color-teal)', mt: 1 }} />
          </Box>
        )}
      </Box>
    </Dialog>
  );
};

export default VideoImportModal;
