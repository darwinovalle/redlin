import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import BarChartIcon from '@mui/icons-material/BarChart';

// Analytics surface. Study-time, per-quiz-type accuracy and the streak populate
// here in a later phase (Phase 3). For now it's a welcoming empty state.
const Stats = () => (
  <Box sx={{ minHeight: '100vh', width: '100%', background: 'var(--color-navy-deep)', p: { xs: 3, md: 5 }, color: 'var(--color-white)' }}>
    <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: 0.3, mb: 0.5 }}>Stats</Typography>
    <Typography variant="body1" sx={{ color: 'color-mix(in srgb, var(--color-white) 66%, transparent)', maxWidth: 560 }}>
      Study time per subject, accuracy on your MCQ, Cloze and Feynman practice, and your daily streak — all in one place.
    </Typography>

    <Box sx={{ mt: 6, p: 4, borderRadius: 4, border: '1.5px dashed color-mix(in srgb, var(--color-white) 20%, transparent)', textAlign: 'center' }}>
      <Box sx={{ display: 'inline-flex', width: 64, height: 64, borderRadius: '16px', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--color-teal) 16%, transparent)', mb: 2 }}>
        <BarChartIcon sx={{ fontSize: 32, color: 'var(--color-teal)' }} />
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Analytics are on the way</Typography>
      <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)', maxWidth: 420, mx: 'auto' }}>
        Once built, this page will show your study time, master accuracy per quiz type, and your study streak as you practice across subjects.
      </Typography>
    </Box>
  </Box>
);

export default Stats;