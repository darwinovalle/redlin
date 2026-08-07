import React, { useState } from 'react';
import { Alert, Box, CircularProgress, Typography, Dialog, DialogContent, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import StudyHero from '../common/StudyHero';

// Props: summary (object or null), loading (bool), error (string|null), title
// Hero title + expandable full view, mirroring the document Summary panel.
const VideoSummary = ({ summary, loading, error, title = '' }) => {
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} sx={{ color: 'var(--color-teal)' }} />
      </Box>
    );
  }
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{String(error)}</Alert>
      </Box>
    );
  }
  if (!summary) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Summary not generated yet.</Alert>
      </Box>
    );
  }
  const content = summary.content || 'No content';
  return (
    <Box sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
      <StudyHero
        title={title}
        subtitle="Summary — the key ideas of the video at a glance."
        onExpand={() => setOpen(true)}
      />
      <Box
        sx={{
          p: 2.5,
          border: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)',
          borderRadius: 4,
          bgcolor: 'color-mix(in srgb, var(--color-navy-deep) 82%, transparent)',
          boxShadow: '0 18px 48px color-mix(in srgb, var(--color-black) 24%, transparent)',
        }}
      >
        <Typography variant="overline" sx={{ letterSpacing: 2.5, color: 'color-mix(in srgb, var(--color-white) 50%, transparent)' }}>
          Summary
        </Typography>
        <Box sx={{
          lineHeight: 1.6,
          fontSize: '0.95rem',
          '& h1, & h2, & h3, & h4, & h5, & h6': { color: 'var(--color-white)', fontWeight: 700, mt: 2.5, mb: 0.75 },
          '& p': { mb: 1.5, color: 'color-mix(in srgb, var(--color-white) 90%, transparent)' },
          '& li': { mb: 0.5, color: 'color-mix(in srgb, var(--color-white) 90%, transparent)' },
          '& ul, & ol': { pl: 3, mb: 1.5 },
          '& a': { color: 'var(--color-teal)' },
          '& code': { fontFamily: 'monospace', background: 'color-mix(in srgb, var(--color-white) 10%, transparent)', color: 'var(--color-teal-pale)', px: 0.5, borderRadius: 0.5 },
          '& pre': { p: 1.5, background: 'color-mix(in srgb, var(--color-black) 40%, transparent)', color: 'var(--color-white)', borderRadius: 2, overflow: 'auto', mb: 1.5 },
        }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </Box>
      </Box>

      {/* Full view */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{
          style: { backgroundColor: '#1A2A3A' },
          sx: { borderRadius: '20px', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', maxHeight: '92vh', overflow: 'hidden' },
        }}
        slotProps={{
          backdrop: { sx: { backgroundColor: 'color-mix(in srgb, var(--color-navy-deep) 74%, transparent)', backdropFilter: 'blur(10px)' } },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography sx={{ color: 'var(--color-white)', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{title || 'Summary'}</Typography>
          <IconButton onClick={() => setOpen(false)} size="small" sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <DialogContent sx={{ p: { xs: 2, sm: 3 }, overflowY: 'auto' }}>
          <Box sx={{
            lineHeight: 1.7,
            fontSize: '0.95rem',
            '& h1, & h2, & h3, & h4, & h5, & h6': { color: 'var(--color-white)', fontWeight: 700, mt: 2.5, mb: 0.75 },
            '& p': { mb: 1.5, color: 'color-mix(in srgb, var(--color-white) 90%, transparent)' },
            '& li': { mb: 0.5, color: 'color-mix(in srgb, var(--color-white) 90%, transparent)' },
            '& ul, & ol': { pl: 3, mb: 1.5 },
            '& a': { color: 'var(--color-teal)' },
            '& code': { fontFamily: 'monospace', background: 'color-mix(in srgb, var(--color-white) 10%, transparent)', color: 'var(--color-teal-pale)', px: 0.5, borderRadius: 0.5 },
            '& pre': { p: 1.5, background: 'color-mix(in srgb, var(--color-black) 40%, transparent)', color: 'var(--color-white)', borderRadius: 2, overflow: 'auto', mb: 1.5 },
          }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default VideoSummary;