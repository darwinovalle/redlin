import React from 'react';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Props: summary (object or null), loading (bool), error (string|null)
const VideoSummary = ({ summary, loading, error }) => {
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
    </Box>
  );
};

export default VideoSummary;
