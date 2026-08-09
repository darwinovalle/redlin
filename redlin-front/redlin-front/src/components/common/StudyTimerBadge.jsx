import React from 'react';
import Box from '@mui/material/Box';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';

const fmt = (s) => `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, '0')}s`;

// Visible live counter for the total time spent on the current study page.
const StudyTimerBadge = ({ seconds }) => (
  <Box
    sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.6,
      borderRadius: 999, border: '1px solid color-mix(in srgb, var(--color-teal) 45%, transparent)',
      bgcolor: 'color-mix(in srgb, var(--color-teal) 12%, transparent)',
      color: 'var(--color-teal)', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
    }}
  >
    <TimerOutlinedIcon sx={{ fontSize: 16 }} />
    {fmt(seconds)}
  </Box>
);

export default StudyTimerBadge;