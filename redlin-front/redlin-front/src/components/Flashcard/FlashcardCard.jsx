import React from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';

// Reusable flashcard presentational component
// Props:
// - card: { key_term, definition, image }
// - isFlipped: boolean
// - onToggleFlip: () => void
// - blink?: boolean (adds quick outline to indicate flip)
// - size?: 'sm' | 'md' | 'lg' (affects height)
// - sx?: MUI sx overrides
// - showHint?: boolean (shows caption to hint flipping)
const FlashcardCard = ({
  card,
  isFlipped,
  onToggleFlip,
  blink = false,
  size = 'md',
  sx = {},
  showHint = false,
  accentColor = 'var(--color-success-glow)',
  // Optional flip customization
  flipDuration = 600, // ms
  flipPerspective = 1000, // px
  flipAxis = 'y', // 'y' for left/right, 'x' for top/bottom
  flipOrigin = 'center center', // Memorama-style: rotate around center
}) => {
  const heights = { sm: 240, md: 300, lg: 380 };
  const height = heights[size] || heights.md;
  const rotateFn = flipAxis === 'x' ? 'rotateX' : 'rotateY';

  return (
    <Card
      elevation={0}
      square
      role="button"
      tabIndex={0}
      aria-pressed={Boolean(isFlipped)}
      onClick={onToggleFlip}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleFlip?.();
        }
      }}
      sx={{
        position: 'relative',
        width: '100%',
        height,
        cursor: 'pointer',
        // keep the outer as a simple container providing perspective
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 0,
        textAlign: 'center',
  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out, outline 0.1s ease-in-out',
  overflow: 'visible',
        perspective: `${flipPerspective}px`,
        outline: 'none',
        backgroundColor: 'transparent',
        boxShadow: 'none',
        borderRadius: 0,
  isolation: 'isolate',
        '&:hover': { transform: 'scale(1.02)' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 4 },
        ...sx,
      }}
    >
      {/* Flipping inner container carries the visual shell so the whole card flips */}
      <Box
        aria-pressed={Boolean(isFlipped)}
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: '16px',
          boxShadow: 3,
          backgroundColor: 'background.paper',
          p: 3,
          transformStyle: 'preserve-3d',
          transition: `transform ${flipDuration}ms cubic-bezier(0.4, 0.2, 0.2, 1)`,
          transform: `${rotateFn}(${isFlipped ? 180 : 0}deg)`,
          transformOrigin: flipOrigin,
          zIndex: 1,
          willChange: 'transform',
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none',
          },
        }}
      >
        {/* Accent bars now part of the flipping shell */}
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            width: { xs: '70%', sm: '60%', md: '55%' },
            top: 10,
            height: 16,
            borderRadius: 999,
            backgroundColor: accentColor,
            boxShadow: '0 0 18px color-mix(in srgb, var(--color-success-glow) 35%, transparent)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            width: { xs: '70%', sm: '60%', md: '55%' },
            bottom: 10,
            height: 16,
            borderRadius: 999,
            backgroundColor: accentColor,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        {/* Front face */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            borderRadius: '16px',
          }}
        >
          <CardContent
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: 0,
            }}
          >
            {card?.image && (
              <Box
                component="img"
                src={card.image}
                alt="Flashcard image"
                sx={{ maxHeight: '80px', maxWidth: '80%', mb: 2, borderRadius: '8px' }}
              />
            )}
            <Typography variant="h6">{card?.key_term || 'N/A'}</Typography>
            {showHint && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
                Click to see definition
              </Typography>
            )}
          </CardContent>
        </Box>

        {/* Back face */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            transform: `${rotateFn}(180deg)`,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            borderRadius: '16px',
          }}
        >
          <CardContent
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: 0,
            }}
          >
            <Typography variant="body1" sx={{ color: 'text.primary' }}>
              {card?.definition || 'N/A'}
            </Typography>
          </CardContent>
        </Box>
      </Box>
    </Card>
  );
};

export default FlashcardCard;
