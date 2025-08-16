import React from 'react';
import { Box, Modal, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ArrowBack as ArrowBackIcon, ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import FlashcardCard from './FlashcardCard';

// Generic modal to display a flashcard centered with backdrop
// Props:
// - open: boolean
// - onClose: () => void
// - card: flashcard object
// - isFlipped: boolean
// - onToggleFlip: () => void
// - showNav?: boolean
// - onPrev?: () => void
// - onNext?: () => void
// - disablePrev?: boolean
// - disableNext?: boolean
const FlashcardModal = ({ open, onClose, card, isFlipped, onToggleFlip, showNav = false, onPrev, onNext, disablePrev, disableNext }) => {
  // Simple slide-in animation on card change, controlled locally
  const [anim, setAnim] = React.useState({ dir: null, phase: 'idle' }); // dir: 'left' | 'right' | null; phase: 'idle' | 'prep' | 'run'

  const triggerEnter = (dir) => {
    // Prepare off-screen position without transition
    setAnim({ dir, phase: 'prep' });
    // Next frame, run the transition back to center
    // double rAF to ensure style flush across browsers
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnim({ dir, phase: 'run' });
        // After animation completes, reset state
        setTimeout(() => setAnim({ dir: null, phase: 'idle' }), 220);
      });
    });
  };

  const handlePrevClick = () => {
    if (disablePrev) return;
    onPrev && onPrev();
    triggerEnter('left');
  };

  const handleNextClick = () => {
    if (disableNext) return;
    onNext && onNext();
    triggerEnter('right');
  };
 
  // Keyboard shortcuts: F1 (prev), F2 (next) when modal is open
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      const key = e.key || e.code;
      if (key === 'F1') {
        e.preventDefault();
        handlePrevClick();
      } else if (key === 'F2') {
        e.preventDefault();
        handleNextClick();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, handlePrevClick, handleNextClick]);

  const offset = anim.dir === 'right' ? 24 : anim.dir === 'left' ? -24 : 0;
  const isPrep = anim.phase === 'prep';
  const isRun = anim.phase === 'run';
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
        {showNav && (
          <>
            <IconButton
              aria-label="previous card"
              onClick={handlePrevClick}
              disabled={Boolean(disablePrev)}
              sx={{
                position: 'absolute',
                left: { xs: -43, sm: -55, md: -71 },
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 4,
                width: 44,
                height: 44,
                borderRadius: '50%',
                color: 'common.white',
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(38,38,38,0.75)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
                border: '1px solid rgba(255,255,255,0.06)',
                '&:hover': {
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(48,48,48,0.85)',
                },
              }}
            >
              <ArrowBackIcon fontSize="medium" />
            </IconButton>
            <IconButton
              aria-label="next card"
              onClick={handleNextClick}
              disabled={Boolean(disableNext)}
              sx={{
                position: 'absolute',
                right: { xs: -43, sm: -55, md: -71 },
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 4,
                width: 44,
                height: 44,
                borderRadius: '50%',
                color: 'common.white',
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(38,38,38,0.75)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
                border: '1px solid rgba(255,255,255,0.06)',
                '&:hover': {
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(48,48,48,0.85)',
                },
              }}
            >
              <ArrowForwardIcon fontSize="medium" />
            </IconButton>
          </>
        )}
        {/* <IconButton
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
        </IconButton> */}
        <Box
          sx={{
            transition: isRun ? 'transform 200ms ease, opacity 200ms ease' : 'none',
            transform: isPrep ? `translateX(${offset}px)` : 'translateX(0px)',
            opacity: isPrep ? 0 : 1,
          }}
        >
          <FlashcardCard
            card={card}
            isFlipped={isFlipped}
            onToggleFlip={onToggleFlip}
            size="lg"
            showHint={!isFlipped}
          />
        </Box>
      </Box>
    </Modal>
  );
};

export default FlashcardModal;
