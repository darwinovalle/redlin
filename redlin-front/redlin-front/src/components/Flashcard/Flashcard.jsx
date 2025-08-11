import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  AutoAwesome as AutoAwesomeIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  HighlightOff as HighlightOffIcon,
} from '@mui/icons-material';
import { documentService } from '../../services/api';
import FlashcardCard from './FlashcardCard';
import FlashcardModal from './FlashcardModal';

const Flashcard = ({ documentId }) => {
  const [flashcards, setFlashcards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false); // State for blink effect
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFlipped, setModalFlipped] = useState(false);
  const [reviews, setReviews] = useState({}); // { [idOrIndex]: 'known' | 'unknown' }

  useEffect(() => {
    if (!documentId) {
      setFlashcards([]); 
      setCurrentCardIndex(0);
      setError(null);
      setLoading(false);
      return; 
    }

    const fetchFlashcards = async () => {
      setLoading(true);
      setError(null);
      setFlashcards([]); 
      setCurrentCardIndex(0); 
      try {
        const data = await documentService.getFlashcardsForDocument(documentId);
        setFlashcards(data || []); 
      } catch (err) {
        setError(err.message || 'Failed to load flashcards for this document.');
      } finally {
        setLoading(false);
      }
    };

    fetchFlashcards();
  }, [documentId]); 

  const nextCard = () => {
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
    }
  };

  const previousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
    }
  };

  const currentCard = flashcards && flashcards.length > 0 ? flashcards[currentCardIndex] : null;

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    setIsBlinking(true); // Trigger blink
    setTimeout(() => setIsBlinking(false), 150); // Reset blink after 150ms
  };

  const openModalForIndex = (index) => {
    setCurrentCardIndex(index);
    setModalFlipped(false);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  // Toggle review status for a given index, only one active at a time; clicking again clears
  const toggleReview = (index, status) => {
    setReviews((prev) => {
      const key = (flashcards[index] && (flashcards[index].id ?? index)) ?? index;
      const current = prev[key];
      if (current === status) {
        const { [key]: _, ...rest } = prev; // clear status
        return rest;
      }
      return { ...prev, [key]: status };
    });
  };

  React.useEffect(() => {
    setIsFlipped(false);
  }, [currentCardIndex]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 3 }}>
        <LinearProgress sx={{ width: '50%' }} />
        <Typography sx={{ ml: 2 }}>Loading Flashcards...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 3 }}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  if (!documentId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 3 }}>
        <Typography color="text.secondary">Please select a document from the sidebar to view flashcards.</Typography>
      </Box>
    );
  }

  if (!flashcards || flashcards.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 3 }}>
        <Typography color="text.secondary">No flashcards found for this document.</Typography>
      </Box>
    );
  }

console.log('Current Card Data:', currentCard);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3, height: '100%', justifyContent: 'center' }}>
      {/* Progress Indicator */}
      <Box sx={{ width: '80%', maxWidth: '600px', mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 1 }}>
          <AutoAwesomeIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="body2" color="text.secondary">
            {currentCardIndex + 1} of {flashcards.length}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={(currentCardIndex + 1) / flashcards.length * 100}
          sx={{ height: 8, borderRadius: 5 }}
        />
      </Box>

      {/* Card Area */}
      <Box sx={{ width: '90%', maxWidth: '500px', mb: 4 }}>
        <FlashcardCard
          card={currentCard}
          isFlipped={isFlipped}
          onToggleFlip={handleFlip}
          blink={isBlinking}
          size="md"
          showHint={!isFlipped}
        />
      </Box>

      {/* Navigation Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '90%', maxWidth: '500px' }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={previousCard}
          disabled={currentCardIndex === 0}
          sx={{ borderRadius: '20px', px: 3 }}
        >
          Previous
        </Button>
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon />}
          onClick={nextCard}
          disabled={currentCardIndex === flashcards.length - 1}
          sx={{ borderRadius: '20px', px: 3 }}
        >
          Next
        </Button>
      </Box>

      {/* Divider */}
      <Divider sx={{ width: '90%', maxWidth: '600px', my: 3 }} />

      {/* List of Flashcard Questions */}
      <Box sx={{ width: '90%', maxWidth: '600px', flexGrow: 1, overflowY: 'auto', mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 1, textAlign: 'center', color: 'text.primary' }}>
          Card Overview
        </Typography>
        <List dense sx={{ borderRadius: '8px' }}>
          {flashcards.map((card, index) => {
            const itemKey = card.id ?? index;
            const status = reviews[itemKey] || null; // 'known' | 'unknown' | null
            return (
            <ListItem
              key={card.id || `card-${index}`}
              secondaryAction={
                <Box>
                  <IconButton 
                    edge="end" 
                    aria-label="know it"
                    aria-pressed={status === 'known'}
                    onClick={(e) => { e.stopPropagation(); toggleReview(index, 'known'); }}
                  >
                    <CheckCircleOutlineIcon sx={{ color: status === 'known' ? 'success.main' : 'text.disabled' }} />
                  </IconButton>
                  <IconButton 
                    edge="end" 
                    aria-label="don't know it"
                    sx={{ ml: 1 }}
                    aria-pressed={status === 'unknown'}
                    onClick={(e) => { e.stopPropagation(); toggleReview(index, 'unknown'); }}
                  >
                    <HighlightOffIcon sx={{ color: status === 'unknown' ? 'error.main' : 'text.disabled' }} />
                  </IconButton>
                </Box>
              }
              disablePadding
              selected={index === currentCardIndex}
              sx={{
                py: 1.5, 
                borderBottom: index < flashcards.length - 1 ? '1px solid' : 'none', 
                borderColor: 'divider', 
                borderRadius: 1,
                transition: 'background-color 120ms ease',
                '&:hover': {
                  backgroundColor: (theme) => theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[200],
                },
                '&.Mui-selected': {
                  backgroundColor: 'action.selected',
                },
                '&.Mui-selected:hover': {
                  backgroundColor: 'action.selected',
                },
              }}
            >
              <ListItemButton
                onClick={() => openModalForIndex(index)}
                sx={{
                  pl: 2,
                  pr: 14,
                  // hover/selected background is handled by ListItem
                }}
              >
                <ListItemText
                  id={`flashcard-list-item-${card.id}`}
                  primary={`${index + 1}. ${card.key_term}`}
                  primaryTypographyProps={{ 
                    color: 'text.primary', 
                    noWrap: true,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );})}
        </List>
      </Box>

      {/* Modal for viewing card from overview */}
      <FlashcardModal
        open={modalOpen}
        onClose={closeModal}
        card={currentCard}
        isFlipped={modalFlipped}
        onToggleFlip={() => setModalFlipped((f) => !f)}
      />
    </Box>
  );
};

export default Flashcard;
