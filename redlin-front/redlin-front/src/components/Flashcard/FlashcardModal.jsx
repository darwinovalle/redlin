import React from 'react';
import { Box, Modal, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FlashcardCard from './FlashcardCard';

// Generic modal to display a flashcard centered with backdrop
// Props:
// - open: boolean
// - onClose: () => void
// - card: flashcard object
// - isFlipped: boolean
// - onToggleFlip: () => void
const FlashcardModal = ({ open, onClose, card, isFlipped, onToggleFlip }) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="flashcard-modal-title"
      aria-describedby="flashcard-modal-description"
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '90%',
          maxWidth: 640,
          outline: 'none',
        }}
      >
        <IconButton
          aria-label="close"
          onClick={onClose}
          size="small"
          disableRipple
          disableFocusRipple
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            zIndex: 2,
            p: 0.5,
            color: 'text.secondary',
            backgroundColor: 'transparent',
            '&:hover': { backgroundColor: 'transparent', color: 'text.secondary' },
            '&:active': { backgroundColor: 'transparent' },
            '&:focus': { outline: 'none' },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
        <FlashcardCard
          card={card}
          isFlipped={isFlipped}
          onToggleFlip={onToggleFlip}
          size="lg"
          showHint={!isFlipped}
        />
      </Box>
    </Modal>
  );
};

export default FlashcardModal;
