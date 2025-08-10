import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  LinearProgress,
  List,
  ListItem,
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

const Flashcard = ({ documentId }) => {
  const [flashcards, setFlashcards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false); // State for blink effect
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

      {/* Card Area - Simple Toggle (No Animation) */}
      <Box sx={{ width: '90%', maxWidth: '500px', height: '300px', mb: 4 }}>
        <Card
          onClick={handleFlip}
          sx={{
            width: '100%',
            height: '100%',
            cursor: 'pointer',
            borderRadius: '16px',
            boxShadow: 3, // Base shadow
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
            textAlign: 'center',
            backgroundColor: 'background.paper', 
            transition: 'transform 0.2s ease-in-out, boxShadow 0.2s ease-in-out, outline 0.1s ease-in-out', // Added transitions
            outline: isBlinking ? '3px solid lightgreen' : 'none', // Conditional green blink outline
            '&:hover': { // Hover effect
              transform: 'scale(1.02)',
              boxShadow: 6, // Increase shadow on hover
            },
          }}
        >
          {/* Conditional Rendering based on isFlipped */}
          {isFlipped ? (
            // Back of Card (Definition)
            <CardContent sx={{ width: '100%', height: '100%' }}>
              <Typography variant="body1" sx={{ color: 'text.primary' }}> 
                {currentCard?.definition || 'N/A'}
              </Typography>
            </CardContent>
          ) : (
            // Front of Card (Term)
            <CardContent sx={{ width: '100%', height: '100%' }}>
              {currentCard?.image && (
                <Box
                  component="img"
                  src={currentCard.image}
                  alt="Flashcard image"
                  sx={{ maxHeight: '80px', maxWidth: '80%', mb: 2, borderRadius: '8px' }}
                />
              )}
              <Typography variant="h6">
                {currentCard?.key_term || 'N/A'} 
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
                Click to see definition
              </Typography>
            </CardContent>
          )}
        </Card>
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
          {flashcards.map((card, index) => (
            <ListItem
              key={card.id || `card-${index}`}
              secondaryAction={
                <Box>
                  <IconButton 
                    edge="end" 
                    aria-label="know it"
                  >
                    <CheckCircleOutlineIcon />
                  </IconButton>
                  <IconButton 
                    edge="end" 
                    aria-label="don't know it"
                    sx={{ ml: 1 }}
                  >
                    <HighlightOffIcon />
                  </IconButton>
                </Box>
              }
              disablePadding
              sx={{
                py: 1.5, 
                borderBottom: index < flashcards.length - 1 ? '1px solid' : 'none', 
                borderColor: 'divider', 
              }}
            >
              <ListItemText
                id={`flashcard-list-item-${card.id}`}
                primary={`${index + 1}. ${card.key_term}`}
                primaryTypographyProps={{ 
                  color: 'text.primary', 
                  noWrap: true, 
                  sx:{ 
                    pr: '100px' 
                  }
                }}
                sx={{ pl: 2 }} 
              />
            </ListItem>
          ))}
        </List>
      </Box>
    </Box>
  );
};

export default Flashcard;
