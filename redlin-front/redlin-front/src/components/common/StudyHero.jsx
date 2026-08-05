import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import IconButton from '@mui/material/IconButton';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';

// Hero header shown inside each study panel. Title + description sit on the
// left; the action (Focus Mode toggle, or the summary expand icon) on the right.
// Typography mirrors the Classroom Spaces hero.
const StudyHero = ({ title, subtitle, focus, onFocusChange, onExpand }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3, mb: 2.5 }}>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography variant="h3" sx={{ fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 0.95, mb: '14px', maxWidth: '14ch', color: 'var(--color-white)' }}>
        {title}
      </Typography>
      <Typography variant="body1" sx={{ maxWidth: '56ch', color: 'color-mix(in srgb, var(--color-white) 74%, transparent)' }}>
        {subtitle}
      </Typography>
    </Box>
    <Box sx={{ flexShrink: 0 }}>
      {onExpand ? (
        <IconButton
          aria-label="Open summary fullscreen"
          title="Open summary fullscreen"
          onClick={onExpand}
          size="small"
          sx={{ color: 'color-mix(in srgb, var(--color-white) 70%, transparent)', '&:hover': { color: 'var(--color-white)', backgroundColor: 'rgba(255,255,255,0.1)' } }}
        >
          <OpenInFullIcon fontSize="small" />
        </IconButton>
      ) : onFocusChange ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {focus ? <LockIcon sx={{ fontSize: 15, color: 'var(--color-teal)' }} /> : <LockOpenIcon sx={{ fontSize: 15, color: 'color-mix(in srgb, var(--color-white) 55%, transparent)' }} />}
          <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 70%, transparent)', fontWeight: 600, letterSpacing: 0.3 }}>Focus Mode</Typography>
          <Switch
            checked={focus}
            onChange={(e) => onFocusChange(e.target.checked)}
            size="small"
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked': { color: 'var(--color-teal)' },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: 'var(--color-teal)' },
              '& .MuiSwitch-switchBase.Mui-checked:hover': { backgroundColor: 'color-mix(in srgb, var(--color-teal) 12%, transparent)' },
            }}
          />
        </Box>
      ) : null}
    </Box>
  </Box>
);

export default StudyHero;
