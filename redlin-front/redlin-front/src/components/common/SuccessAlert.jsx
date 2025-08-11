import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const SuccessAlert = ({ open, message, onClose, autoHideDuration = 5000 }) => {
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [open, autoHideDuration, onClose]);

  if (!visible) return null;
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 32,
        right: 32,
        zIndex: 1500,
        bgcolor: '#000',
        color: '#fff',
        px: 3,
        py: 2,
        borderRadius: 2,
        boxShadow: 4,
        display: 'flex',
        alignItems: 'center',
        minWidth: 280,
        maxWidth: 400,
      }}
    >
      <CheckCircleIcon sx={{ color: '#39ff14', mr: 1, fontSize: 28 }} />
      <Typography variant="body1" sx={{ flex: 1, color: '#fff' }}>{message}</Typography>
      <IconButton
        size="small"
        onClick={() => { setVisible(false); onClose?.(); }}
        sx={{ color: '#fff', ml: 2 }}
        aria-label="close"
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};

export default SuccessAlert;
