import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import CloseIcon from '@mui/icons-material/Close';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import StudyHero from '../common/StudyHero';
import { documentService } from '../../services/api';

const Summary = ({ documentId, title = '' }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchSummary = async () => {
      if (!documentId) {
        setSummary(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await documentService.getSummaryForDocument(documentId);
        if (!cancelled) setSummary(data);
      } catch (err) {
        if (!cancelled) setError(err?.details || err?.message || 'Error fetching summary');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchSummary();
    return () => { cancelled = true; };
  }, [documentId]);

  if (!documentId) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>
          Select a document to view its summary.
        </Typography>
      </Box>
    );
  }

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
        <Alert severity="warning">No summary available for this document yet.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
      <StudyHero
        title={title}
        subtitle="Summary — the key ideas of the document at a glance."
        onExpand={() => setSummaryOpen(true)}
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 1.5 }}>
          <Typography variant="overline" sx={{ letterSpacing: 2.5, color: 'color-mix(in srgb, var(--color-white) 50%, transparent)' }}>
            Summary
          </Typography>
        </Box>
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
            {summary?.content || 'No content'}
          </ReactMarkdown>
        </Box>
      </Box>

      <Dialog
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{
          style: { backgroundColor: '#1A2A3A' },
          sx: {
            borderRadius: '20px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            maxHeight: '92vh',
            overflow: 'hidden',
          },
        }}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'color-mix(in srgb, var(--color-navy-deep) 74%, transparent)',
              backdropFilter: 'blur(10px)',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography sx={{ color: 'var(--color-white)', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Summary</Typography>
          <IconButton onClick={() => setSummaryOpen(false)} size="small" sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}>
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
              {summary?.content || 'No content'}
            </ReactMarkdown>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default Summary;
