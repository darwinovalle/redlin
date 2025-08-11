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
  accentColor = '#00ff81',
}) => {
  const heights = { sm: 240, md: 300, lg: 380 };
  const height = heights[size] || heights.md;

  return (
    <Card
      onClick={onToggleFlip}
      sx={{
        position: 'relative',
        width: '100%',
        height,
        cursor: 'pointer',
        borderRadius: '16px',
        boxShadow: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        textAlign: 'center',
        backgroundColor: 'background.paper',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out, outline 0.1s ease-in-out',
        outline: blink ? '3px solid lightgreen' : 'none',
        '&:hover': {
          transform: 'scale(1.02)',
          boxShadow: 6,
        },
        // Accent bars
        '&::before, &::after': {
          content: '""',
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '70%',
          height: 16,
          borderRadius: 999,
          backgroundColor: accentColor,
          boxShadow: '0 0 18px rgba(0,255,129,0.35)',
          pointerEvents: 'none',
          zIndex: 0,
          '@media (min-width:600px)': { width: '60%' },
          '@media (min-width:900px)': { width: '55%' },
        },
        '&::before': { top: 10 },
        '&::after': { bottom: 10 },
        ...sx,
      }}
    >
      {isFlipped ? (
        <CardContent
          sx={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <Typography variant="body1" sx={{ color: 'text.primary' }}>
            {card?.definition || 'N/A'}
          </Typography>
        </CardContent>
      ) : (
        <CardContent
          sx={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
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
      )}
    </Card>
  );
};

export default FlashcardCard;
