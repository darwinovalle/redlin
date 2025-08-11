import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// You can import your SVG as a ReactComponent if using SVGR, or use <img src={...} />
import GearSvg from '../../assets/Gear@1x-0.2s-200px-200px (1).svg';

const LoaderOverlay = ({ open, text = 'Uploading...' }) => {
  if (!open) return null;
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        bgcolor: 'rgba(0,0,0,0.85)',
        zIndex: 1400,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img src={GearSvg} alt="Loading" width={120} height={120} style={{ marginBottom: 24 }} />
  <Typography variant="h5" sx={{ color: 'white', fontWeight: 500 }}>{text}</Typography>
    </Box>
  );
};

export default LoaderOverlay;
