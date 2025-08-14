import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, IconButton, LinearProgress, List, ListItem, ListItemButton, ListItemText, Divider } from '@mui/material';
import { ArrowBack as ArrowBackIcon, ArrowForward as ArrowForwardIcon, CheckCircleOutline as CheckCircleOutlineIcon, HighlightOff as HighlightOffIcon } from '@mui/icons-material';
import FlashcardCard from '../Flashcard/FlashcardCard';
import GearSvg from '../../assets/Gear@1x-0.2s-200px-200px (1).svg';
import { csvService } from '../../services/api/csv';

const CSVFlashcards = ({ sourceId }) => {
  const [cards, setCards] = useState([]);
  const [current, setCurrent] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reviews, setReviews] = useState({});

  useEffect(() => {
    if (!sourceId) { setCards([]); setCurrent(0); return; }
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const data = await csvService.listFlashcards({ sourceId });
        setCards(Array.isArray(data) ? data : []);
        setCurrent(0);
      } catch (e) {
        setError(e?.message || 'Failed to load CSV flashcards');
      } finally { setLoading(false); }
    };
    load();
  }, [sourceId]);

  const currentCard = cards[current] || null;
  const next = () => { if (current < cards.length - 1) setCurrent(current + 1); };
  const prev = () => { if (current > 0) setCurrent(current - 1); };
  const flip = () => setIsFlipped((f) => !f);
  useEffect(() => { setIsFlipped(false); }, [current]);

  const toggleReview = (index, status) => {
    setReviews((prev) => {
      const key = cards[index]?.id ?? index;
      const cur = prev[key];
      if (cur === status) { const { [key]: _, ...rest } = prev; return rest; }
      return { ...prev, [key]: status };
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 3 }}>
        <img src={GearSvg} alt="Loading" width={30} height={30} />
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
  if (!sourceId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 3 }}>
        <Typography color="text.secondary">Select a CSV import from the sidebar to view flashcards.</Typography>
      </Box>
    );
  }
  if (!cards.length) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 3 }}>
        <Typography color="text.secondary">No flashcards found for this CSV.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', px: 3, py: 3, height: '100%', overflow: 'hidden', boxSizing: 'border-box', gap: 0 }}>
      <Box sx={{ width: '80%', maxWidth: '600px', mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
            {current + 1} of {cards.length}
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={((current + 1) / cards.length) * 100} sx={{ height: 8, borderRadius: 5, bgcolor: '#fff', '& .MuiLinearProgress-bar': { backgroundColor: '#acf3d0' } }} />
      </Box>

      <Box sx={{ width: '90%', maxWidth: '500px', mb: 4 }}>
        <FlashcardCard card={currentCard} isFlipped={isFlipped} onToggleFlip={flip} blink={false} size="md" showHint={!isFlipped} />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '90%', maxWidth: '500px' }}>
        <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={prev} disabled={current === 0} sx={{ borderRadius: '20px', px: 3, backgroundColor: '#6be0a6' }} />
        <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={next} disabled={current === cards.length - 1} sx={{ borderRadius: '20px', px: 3, backgroundColor: '#6be0a6' }} />
      </Box>

      <Divider sx={{ width: '90%', maxWidth: '600px', my: 2 }} />

      <Box sx={{ width: '90%', maxWidth: '600px', maxHeight: '27.5vh', overflowY: 'auto', mb: 2, scrollbarWidth: 'thin', scrollbarColor: (theme) => `${theme.palette.divider} transparent`, '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' }, '&::-webkit-scrollbar-thumb': { backgroundColor: 'divider', borderRadius: 8 } }}>
        <Typography variant="h6" sx={{ mb: 1, textAlign: 'center', color: 'text.primary' }}>Card Overview</Typography>
        <List dense sx={{ borderRadius: '8px' }}>
          {cards.map((card, index) => {
            const key = card.id ?? index;
            const status = reviews[key] || null;
            return (
              <ListItem key={key} secondaryAction={
                <Box>
                  <IconButton edge="end" aria-label="know it" aria-pressed={status === 'known'} onClick={(e) => { e.stopPropagation(); toggleReview(index, 'known'); }}>
                    <CheckCircleOutlineIcon sx={{ color: status === 'known' ? 'success.main' : 'text.disabled' }} />
                  </IconButton>
                  <IconButton edge="end" aria-label="don't know it" sx={{ ml: 1 }} aria-pressed={status === 'unknown'} onClick={(e) => { e.stopPropagation(); toggleReview(index, 'unknown'); }}>
                    <HighlightOffIcon sx={{ color: status === 'unknown' ? 'error.main' : 'text.disabled' }} />
                  </IconButton>
                </Box>
              } disablePadding selected={index === current} sx={{ py: 1.5, borderBottom: index < cards.length - 1 ? '1px solid' : 'none', borderColor: 'divider', borderRadius: 1, transition: 'background-color 120ms ease', '&:hover': { backgroundColor: (theme) => theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[200] }, '&.Mui-selected': { backgroundColor: 'action.selected' }, '&.Mui-selected:hover': { backgroundColor: 'action.selected' } }}>
                <ListItemButton onClick={() => setCurrent(index)} sx={{ pl: 2, pr: 14 }}>
                  <ListItemText primary={`${index + 1}. ${card.key_term}`} primaryTypographyProps={{ color: 'text.primary', noWrap: true }} />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </Box>
  );
};

export default CSVFlashcards;
