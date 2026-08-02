import React, { useEffect, useState } from 'react';
import {
  Dialog,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';

export default function RenameDialog({
  open,
  initialValue = '',
  onClose,
  onSubmit,
  submitting = false,
  title = 'Rename document',
  label = 'Title',
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue || '');
  }, [open, initialValue]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!value?.trim() || submitting) return;
    onSubmit?.(value.trim());
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        style: { backgroundColor: '#1A2A3A' },
        sx: {
          width: { xs: '92vw', sm: 420 },
          maxWidth: '92vw',
          borderRadius: '20px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        },
      }}
      slotProps={{
        backdrop: { sx: { backgroundColor: 'color-mix(in srgb, var(--color-black) 60%, transparent)' } },
      }}
    >
      <form onSubmit={handleSubmit}>
        {/* ── Header bar ── */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 2.25,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <EditIcon sx={{ color: '#20C997', fontSize: 22 }} />
            <Typography sx={{ color: 'white', fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {title}
            </Typography>
          </Box>
          <IconButton
            onClick={onClose}
            size="small"
            disabled={submitting}
            sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* ── Body ── */}
        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
          <TextField
            autoFocus
            fullWidth
            label={label}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={submitting}
            InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.65)' } }}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#E0E0E0',
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: '10px',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.22)' },
                '&.Mui-focused fieldset': { borderColor: 'rgba(32,201,151,0.55)' },
              },
              '& .MuiInputBase-input::placeholder': { color: 'rgba(255,255,255,0.3)' },
            }}
          />
        </Box>

        {/* ── Footer ── */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 1.5,
            px: 3,
            py: 2.5,
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Button
            onClick={onClose}
            disabled={submitting}
            sx={{
              px: 2,
              py: 1.15,
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.06)',
              color: '#E0E0E0',
              fontWeight: 600,
              fontSize: 14,
              textTransform: 'none',
              '&:hover': { background: 'rgba(255,255,255,0.1)' },
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!value.trim() || value.trim() === (initialValue || '').trim() || submitting}
            sx={{
              px: 3,
              py: 1.15,
              borderRadius: '12px',
              background: '#20C997',
              color: '#0A1628',
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: '0.02em',
              textTransform: 'none',
              boxShadow: '0 6px 20px rgba(32,201,151,0.25)',
              '&:hover': { background: 'var(--color-teal-hover)', boxShadow: '0 6px 24px rgba(32,201,151,0.4)' },
              '&.Mui-disabled': { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.36)' },
            }}
          >
            {submitting ? <CircularProgress size={16} sx={{ mr: 1, color: '#0A1628' }} /> : null}
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </Box>
      </form>
    </Dialog>
  );
}
