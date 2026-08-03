import React from 'react';
import {
  Dialog,
  Box,
  Typography,
  IconButton,
  Button,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

// Navy-gradient glass shell matching the CaptureAudioModal (the popup shown
// when a new classroom space is created).
export default function ConfirmDialog({
  open,
  title = 'Delete item',
  message = 'Are you sure you want to delete this item? This action cannot be undone.',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onClose,
  confirming = false,
}) {
  return (
    <Dialog
      open={open}
      onClose={confirming ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="confirm-dialog-title"
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

      <Box sx={{ position: 'relative', p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <DeleteOutlineIcon sx={{ color: 'var(--color-danger-soft)', fontSize: 22 }} />
            <Typography id="confirm-dialog-title" variant="h6" sx={{ color: 'var(--color-white)', fontWeight: 800, letterSpacing: '-0.01em' }}>
              {title}
            </Typography>
          </Box>
          <IconButton
            onClick={onClose}
            size="small"
            disabled={confirming}
            sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Body */}
        <Box sx={{ p: 2, borderRadius: 3, background: 'color-mix(in srgb, var(--color-white) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)' }}>
          <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 82%, transparent)', fontSize: 14, lineHeight: 1.6 }}>
            {message}
          </Typography>
        </Box>

        {/* Footer */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1.5, mt: 2.5 }}>
          <Button
            onClick={onClose}
            disabled={confirming}
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
            {cancelLabel}
          </Button>
          <Button
            variant="contained"
            onClick={onConfirm}
            disabled={confirming}
            sx={{
              px: 4,
              py: 1.15,
              borderRadius: '999px',
              fontWeight: 700,
              fontSize: 14,
              textTransform: 'none',
              backgroundColor: 'var(--color-danger)',
              color: '#ffffff',
              boxShadow: '0 10px 28px color-mix(in srgb, var(--color-danger) 32%, transparent)',
              '&:hover': { backgroundColor: 'var(--color-danger-deep)', boxShadow: '0 10px 32px color-mix(in srgb, var(--color-danger) 45%, transparent)' },
              '&.Mui-disabled': { bgcolor: 'color-mix(in srgb, var(--color-white) 10%, transparent)', color: 'color-mix(in srgb, var(--color-white) 36%, transparent)' },
            }}
          >
            {confirming ? <CircularProgress size={16} sx={{ mr: 1, color: '#ffffff' }} /> : null}
            {confirming ? 'Deleting…' : confirmLabel}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
