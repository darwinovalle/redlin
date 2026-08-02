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
          <DeleteOutlineIcon sx={{ color: 'var(--color-danger-soft)', fontSize: 22 }} />
          <Typography sx={{ color: 'white', fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>
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

      {/* ── Body ── */}
      <Box sx={{ px: 3, pt: 3, pb: 2 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 1.6 }}>
          {message}
        </Typography>
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
          disabled={confirming}
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
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={confirming}
          sx={{
            px: 3,
            py: 1.15,
            borderRadius: '12px',
            background: 'var(--color-danger)',
            color: 'white',
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: '0.02em',
            textTransform: 'none',
            boxShadow: '0 6px 20px color-mix(in srgb, var(--color-danger) 30%, transparent)',
            '&:hover': { background: 'var(--color-danger-deep)', boxShadow: '0 6px 24px color-mix(in srgb, var(--color-danger) 45%, transparent)' },
            '&.Mui-disabled': { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.36)' },
          }}
        >
          {confirming ? <CircularProgress size={16} sx={{ mr: 1, color: 'white' }} /> : null}
          {confirming ? 'Deleting…' : confirmLabel}
        </Button>
      </Box>
    </Dialog>
  );
}
