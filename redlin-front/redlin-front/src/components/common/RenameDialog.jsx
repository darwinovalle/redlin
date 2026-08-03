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

// Navy-gradient glass shell matching the CaptureAudioModal (the popup shown
// when a new classroom space is created).
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
      maxWidth="sm"
      aria-labelledby="rename-dialog-title"
      PaperProps={{
        style: {
          background: 'linear-gradient(135deg, var(--color-navy-050) 0%, var(--color-navy-200) 48%, var(--color-navy) 100%)',
        },
        sx: {
          width: { xs: '92vw', sm: 560 },
          maxWidth: '92vw',
          borderRadius: '20px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          position: 'relative',
        },
      }}
      slotProps={{
        backdrop: { sx: { backgroundColor: 'color-mix(in srgb, var(--color-black) 60%, transparent)' } },
      }}
    >
      {/* Teal / blue glow accents over the navy gradient */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at top left, color-mix(in srgb, var(--color-teal) 20%, transparent), transparent 45%), ' +
            'radial-gradient(circle at bottom right, color-mix(in srgb, var(--color-blue) 22%, transparent), transparent 48%)',
        }}
      />

      <form onSubmit={handleSubmit}>
        <Box sx={{ position: 'relative', p: 3 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <EditIcon sx={{ color: 'var(--color-teal)', fontSize: 22 }} />
              <Typography id="rename-dialog-title" variant="h6" sx={{ color: 'var(--color-white)', fontWeight: 800, letterSpacing: '-0.01em' }}>
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

          {/* Body */}
          <TextField
            autoFocus
            fullWidth
            label={label}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={submitting}
            InputLabelProps={{ sx: { color: 'color-mix(in srgb, var(--color-white) 65%, transparent)' } }}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'var(--color-white)',
                backgroundColor: 'color-mix(in srgb, var(--color-white) 4%, transparent)',
                borderRadius: '12px',
                '& fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 12%, transparent)' },
                '&:hover fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 22%, transparent)' },
                '&.Mui-focused fieldset': { borderColor: 'color-mix(in srgb, var(--color-teal) 60%, transparent)' },
              },
            }}
          />

          {/* Footer */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1.5, mt: 2.5 }}>
            <Button
              onClick={onClose}
              disabled={submitting}
              sx={{
                px: 3,
                py: 1.15,
                borderRadius: '999px',
                fontWeight: 700,
                fontSize: 14,
                textTransform: 'none',
                color: 'var(--color-white)',
                border: '1px solid color-mix(in srgb, var(--color-white) 22%, transparent)',
                '&:hover': { borderColor: 'var(--color-teal)', backgroundColor: 'color-mix(in srgb, var(--color-teal) 10%, transparent)' },
                '&.Mui-disabled': { borderColor: 'color-mix(in srgb, var(--color-white) 12%, transparent)', color: 'color-mix(in srgb, var(--color-white) 40%, transparent)' },
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!value.trim() || value.trim() === (initialValue || '').trim() || submitting}
              sx={{
                px: 4,
                py: 1.15,
                borderRadius: '999px',
                fontWeight: 700,
                fontSize: 14,
                textTransform: 'none',
                backgroundColor: 'var(--color-success)',
                color: 'var(--color-navy-deep)',
                boxShadow: '0 10px 28px color-mix(in srgb, var(--color-success) 30%, transparent)',
                '&:hover': { backgroundColor: 'var(--color-teal-pale)' },
                '&.Mui-disabled': { bgcolor: 'color-mix(in srgb, var(--color-white) 8%, transparent)', color: 'color-mix(in srgb, var(--color-white) 36%, transparent)' },
              }}
            >
              {submitting ? <CircularProgress size={16} sx={{ mr: 1, color: 'var(--color-navy-deep)' }} /> : null}
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </Box>
        </Box>
      </form>
    </Dialog>
  );
}
