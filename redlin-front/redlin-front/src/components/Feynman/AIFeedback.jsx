import React from 'react';
import { Box, Typography, Chip } from '@mui/material';

const Metric = ({ label, value, color }) => (
  <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', p:1, minWidth:80 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="subtitle1" sx={{ fontWeight:'bold', color }}>{value ?? '—'}</Typography>
  </Box>
);

const AIFeedback = ({ attempt }) => {
  if (!attempt) return null;
  const b = attempt.breakdown || {};
  return (
    <Box sx={{ mt:3, p:2, border:'1px solid var(--color-divider-soft)', borderRadius:2, background:'var(--color-surface-muted)' }}>
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:1 }}>
        <Typography variant="h6" sx={{ fontWeight:'bold' }}>AI Evaluation</Typography>
        {attempt.score != null && <Chip label={`Score: ${attempt.score}`} color={attempt.score>=80? 'success': attempt.score>=60?'warning':'error'} />}
      </Box>
      <Box sx={{ display:'flex', flexWrap:'wrap' }}>
        <Metric label="Coverage" value={formatPct(b.coverage)} color="var(--color-text)" />
        <Metric label="Accuracy" value={formatPct(b.accuracy)} color="var(--color-text)" />
        <Metric label="Clarity" value={formatPct(b.clarity)} color="var(--color-text)" />
        <Metric label="Simplicity" value={formatPct(b.simplicity)} color="var(--color-text)" />
        <Metric label="Misconceptions" value={formatPct(b.misconceptions_penalty, true)} color="var(--color-danger-deep)" />
        <Metric label="Hallucination" value={formatPct(b.hallucination_penalty, true)} color="var(--color-danger-deep)" />
        {attempt.key_points_coverage != null && <Metric label="KP Coverage" value={formatPct(attempt.key_points_coverage)} color="var(--color-text)" />}
      </Box>
      {b.feedback && <Typography variant="body2" sx={{ mt:2, whiteSpace:'pre-wrap' }}>{b.feedback}</Typography>}
      {b.parse_error && <Typography variant="body2" color="error" sx={{ mt:2 }}>Parse error: raw response stored.</Typography>}
    </Box>
  );
};

function formatPct(v, isPenalty=false){
  if(v==null) return '—';
  const pct=Math.round(v*100);
  return (isPenalty? '-'+pct:pct)+'%';
}

export default AIFeedback;
