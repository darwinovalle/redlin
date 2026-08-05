import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';

// Centered Focus Mode toggle shown below each study panel's Start button.
const FocusToggle = ({ focus, onChange }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 2 }}>
    {focus ? <LockIcon sx={{ fontSize: 15, color: 'var(--color-teal)' }} /> : <LockOpenIcon sx={{ fontSize: 15, color: 'color-mix(in srgb, var(--color-white) 55%, transparent)' }} />}
    <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 70%, transparent)', fontWeight: 600, letterSpacing: 0.3 }}>Focus Mode</Typography>
    <Switch
      checked={focus}
      onChange={(e) => onChange(e.target.checked)}
      size="small"
      sx={{
        '& .MuiSwitch-switchBase.Mui-checked': { color: 'var(--color-teal)' },
        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: 'var(--color-teal)' },
        '& .MuiSwitch-switchBase.Mui-checked:hover': { backgroundColor: 'color-mix(in srgb, var(--color-teal) 12%, transparent)' },
      }}
    />
  </Box>
);

export default FocusToggle;
