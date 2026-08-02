import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { documentService } from '../../services/api';

const Summary = ({ documentId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);

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
    return <Alert severity="info">Select a document to view its summary.</Alert>;
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{String(error)}</Alert>;
  }

  if (!summary) {
    return <Alert severity="warning">No summary available for this document yet.</Alert>;
  }

  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Summary
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{
        lineHeight: 1.6,
        fontSize: '0.95rem',
        '& h1, & h2, & h3, & h4': { fontWeight: 600, mt: 3, mb: 1 },
        '& p': { mb: 2 },
        '& ul': { pl: 3, mb: 2 },
        '& ol': { pl: 3, mb: 2 },
        '& li': { mb: 0.5 },
        '& pre': { p: 1.5, background: 'var(--color-surface-input)', color: 'var(--color-text)', borderRadius: 1, overflow: 'auto', mb: 2 },
        '& code': { fontFamily: 'monospace', background: 'var(--color-surface-input)', color: 'var(--color-text)', px: 0.5, borderRadius: 0.5 },
        position: 'relative',
        zIndex: 1
      }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({node, ...props}) => <Typography variant="h4" {...props} />,
            h2: ({node, ...props}) => <Typography variant="h5" {...props} />,
            h3: ({node, ...props}) => <Typography variant="h6" {...props} />,
            h4: ({node, ...props}) => <Typography variant="subtitle1" {...props} />,
            p: ({node, ...props}) => <Typography variant="body1" paragraph {...props} />,
            li: ({node, ordered, ...props}) => <li {...props} />
          }}
        >
          {summary?.content || 'No content'}
        </ReactMarkdown>
      </Box>
    </Paper>
  );
};

export default Summary;
