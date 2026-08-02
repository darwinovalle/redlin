import React from 'react';
import { Alert, Box, Divider, Paper, Typography } from '@mui/material';
import piggy from '../../assets/piggy.svg';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Props: summary (object or null), loading (bool), error (string|null)
const VideoSummary = ({ summary, loading, error }) => {
  if (loading) {
    return <Typography variant="body2" sx={{ mt:2 }}>Loading summary...</Typography>;
  }
  if (error) {
    return <Alert severity="error">{String(error)}</Alert>;
  }
  if (!summary) {
    return <Alert severity="warning">Summary not generated yet.</Alert>;
  }
  const content = summary.content || 'No content';
  return (
    <Paper elevation={1} sx={{
      p: 2,
      position:'relative',
      overflow:'hidden',
      backgroundColor:'var(--color-white)',
      color:'var(--color-text)',
      '&::before': {
        content:'""',
        position:'absolute',
        inset:0,
        // backgroundImage:`url(${piggy})`,
        backgroundRepeat:'repeat',
        backgroundPosition:'center 180px',
        backgroundSize:'200px',
        pointerEvents:'none',
        opacity: '0.8',
        zIndex:0
      }
    }}>
      <Typography variant="h6" gutterBottom>Summary</Typography>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{
        lineHeight: 1.6,
        fontSize: '0.95rem',
        color: 'var(--color-text)',
        '& h1, & h2, & h3, & h4': { fontWeight: 600, mt: 3, mb: 1 },
        '& p': { mb: 2 },
        '& ul': { pl: 3, mb: 2 },
        '& ol': { pl: 3, mb: 2 },
        '& li': { mb: 0.5 },
        '& pre': { p:1.5, background:'var(--color-surface-input)', color:'var(--color-text)', borderRadius:1, overflow:'auto', mb:2 },
  '& code': { fontFamily: 'monospace', background:'var(--color-surface-input)', color:'var(--color-text)', px:0.5, borderRadius:0.5 },
  position:'relative', zIndex:1
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
          {content}
        </ReactMarkdown>
      </Box>
    </Paper>
  );
};

export default VideoSummary;
