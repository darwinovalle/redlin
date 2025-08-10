import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
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
      <Box sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '1rem' }}>
        {summary?.content || 'No content'}
      </Box>
    </Paper>
  );
};

export default Summary;
