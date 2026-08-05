import React from 'react';
import { Box, Button, Chip, Dialog, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MicIcon from '@mui/icons-material/Mic';
import PresentToAllIcon from '@mui/icons-material/PresentToAll';

const isFirefox = typeof navigator !== 'undefined' && /Firefox\//i.test(navigator.userAgent);

// Shown the first time a user creates a Classroom Space, to explain how audio
// capture works in their browser (Chrome/Edge share-audio vs Firefox mic).
export default function CaptureAudioModal({ open, onClose }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="capture-info-title"
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
          <Typography id="capture-info-title" variant="h6" sx={{ color: 'var(--color-white)', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Capture meeting audio
          </Typography>
          <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 78%, transparent)', mb: 2 }}>
          To turn the class into study materials, this space needs to capture the audio that is playing. How that works depends on your browser.
        </Typography>

        {isFirefox ? (
          <Box sx={{ p: 2, borderRadius: 3, background: 'color-mix(in srgb, var(--color-white) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <MicIcon sx={{ color: 'var(--color-danger-soft)' }} />
              <Typography variant="subtitle2" sx={{ color: 'var(--color-white)', fontWeight: 700 }}>You&apos;re on Firefox</Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 82%, transparent)' }}>
              Firefox can&apos;t capture the meeting/speaker audio directly from a shared screen, so the recording uses your microphone instead:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 4, mt: 1 }}>
              <Typography component="li" variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 82%, transparent)', mb: 0.5 }}>
                Click <b>Capture audio</b> and allow the microphone.
              </Typography>
              <Typography component="li" variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 82%, transparent)' }}>
                For best results, play the class through your speakers so it is picked up by the mic.
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ p: 2, borderRadius: 3, background: 'color-mix(in srgb, var(--color-white) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <PresentToAllIcon sx={{ color: 'var(--color-teal)' }} />
              <Typography variant="subtitle2" sx={{ color: 'var(--color-white)', fontWeight: 700 }}>Recommended: share the meeting audio</Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 82%, transparent)' }}>
              Click <b>Capture audio</b>, then in the share prompt pick the tab that is playing the meeting (or a window/screen). Only the tab&apos;s audio is recorded — no video.
            </Typography>
          </Box>
        )}

        <Chip
          label={isFirefox ? 'Mic fallback' : 'Tab / window / screen audio'}
          size="small"
          variant="outlined"
          sx={{ color: 'var(--color-white)', borderColor: 'color-mix(in srgb, var(--color-white) 20%, transparent)', mb: 2 }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={onClose}
            sx={{
              px: 4,
              py: 1.15,
              borderRadius: '999px',
              fontWeight: 700,
              fontSize: 14,
              textTransform: 'none',
              backgroundColor: 'var(--color-success)',
              color: 'var(--color-navy-deep)',
              '&:hover': { backgroundColor: 'var(--color-teal-pale)' },
            }}
          >
            Got it
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}