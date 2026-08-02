import React from 'react';
import { Box, Typography, Chip } from '@mui/material';

const Metric = ({ label, value, color }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 1, minWidth: 84 }}>
    <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 52%, transparent)' }}>{label}</Typography>
    <Typography variant="subtitle1" sx={{ fontWeight: 800, color }}>{value ?? '—'}</Typography>
  </Box>
);

const AIFeedback = ({ attempt }) => {
  if (!attempt) return null;
  const b = attempt.breakdown || {};
  return (
    <Box
      sx={{
        mt: 3,
        p: 2,
        border: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)',
        borderRadius: 3,
        bgcolor: 'color-mix(in srgb, var(--color-white) 3%, transparent)',
        color: 'var(--color-white)',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: 'var(--color-white)' }}>AI Evaluation</Typography>
        {attempt.score != null && (
          <Chip
            label={`Score: ${attempt.score}`}
            sx={{
              bgcolor: attempt.score >= 80 ? 'color-mix(in srgb, var(--color-success) 20%, transparent)' : attempt.score >= 60 ? 'color-mix(in srgb, var(--color-amber) 18%, transparent)' : 'color-mix(in srgb, var(--color-danger-softer) 18%, transparent)',
              color: 'var(--color-white)',
              fontWeight: 700,
            }}
          />
        )}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
        <Metric label="Coverage" value={formatPct(b.coverage)} color="var(--color-white)" />
        <Metric label="Accuracy" value={formatPct(b.accuracy)} color="var(--color-white)" />
        <Metric label="Clarity" value={formatPct(b.clarity)} color="var(--color-white)" />
        <Metric label="Simplicity" value={formatPct(b.simplicity)} color="var(--color-white)" />
        <Metric label="Misconceptions" value={formatPct(b.misconceptions_penalty, true)} color="var(--color-danger-faint)" />
        <Metric label="Hallucination" value={formatPct(b.hallucination_penalty, true)} color="var(--color-danger-faint)" />
        {attempt.key_points_coverage != null && <Metric label="KP Coverage" value={formatPct(attempt.key_points_coverage)} color="var(--color-white)" />}
      </Box>
      {b.feedback && (
        <Typography variant="body2" sx={{ mt: 2, whiteSpace: 'pre-wrap', color: 'color-mix(in srgb, var(--color-white) 84%, transparent)' }}>
          {b.feedback}
        </Typography>
      )}
      {b.parse_error && (
        <Typography variant="body2" color="error" sx={{ mt: 2 }}>
          Parse error: raw response stored.
        </Typography>
      )}
    </Box>
  );
};

function formatPct(v, isPenalty = false) {
  if (v == null) return '—';
  const pct = Math.round(v * 100);
  return (isPenalty ? '-' + pct : pct) + '%';
}

export default AIFeedback;
