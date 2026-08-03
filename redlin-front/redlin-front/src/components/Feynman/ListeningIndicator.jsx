import React from 'react';
import Box from '@mui/material/Box';

// Label with three pulsing dots, shown centered inside the answer box while the
// whisper dictation fallback is listening or processing (Firefox).
const ListeningIndicator = ({ label = 'Listening' }) => (
  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color: 'var(--color-danger-soft)', fontWeight: 700, fontSize: 16, letterSpacing: 0.2, userSelect: 'none' }}>
    <span>{label}</span>
    {[0, 1, 2].map((i) => (
      <Box
        key={i}
        sx={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: 'var(--color-danger-soft)',
          animation: 'listenDotPulse 1.2s ease-in-out infinite',
          animationDelay: `${i * 0.2}s`,
        }}
      />
    ))}
  </Box>
);

export default ListeningIndicator;
