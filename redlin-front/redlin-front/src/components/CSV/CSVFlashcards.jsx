import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, IconButton, LinearProgress, List, ListItem, ListItemButton, ListItemText, Divider, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { ArrowBack as ArrowBackIcon, ArrowForward as ArrowForwardIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import FlashcardCard from '../Flashcard/FlashcardCard';
import FlashcardModal from '../Flashcard/FlashcardModal';
import GearSvg from '../../assets/Gear@1x-0.2s-200px-200px (1).svg';
import { csvService } from '../../services/api/csv';
import useClickSound from '../../hooks/useClickSound';
import clickSfx from '../../assets/buttonclick.mp3';
import flipSfx from '../../assets/ui-pop-sound-316482.mp3';
import Keyf1Png from '../../assets/keyboard/icons8-f1-key-30.png';
import Keyf2Png from '../../assets/keyboard/icons8-f2-key-30.png';

const CSVFlashcards = ({ sourceId }) => {
  const [cards, setCards] = useState([]);
  const [current, setCurrent] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reviews, setReviews] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFlipped, setModalFlipped] = useState(false);
  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [editForm, setEditForm] = useState({ key_term: '', definition: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  
  // Animación tipo modal para la vista normal
  const [anim, setAnim] = useState({ dir: null, phase: 'idle' }); // dir: 'left' | 'right' | null; phase: 'idle' | 'prep' | 'run'
  const triggerEnter = (dir) => {
    setAnim({ dir, phase: 'prep' });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnim({ dir, phase: 'run' });
        setTimeout(() => setAnim({ dir: null, phase: 'idle' }), 220);
      });
    });
  };

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
  const next = () => { if (current < cards.length - 1) { setCurrent(current + 1); triggerEnter('right'); } };
  const prev = () => { if (current > 0) { setCurrent(current - 1); triggerEnter('left'); } };
  const flip = () => { playFlip(); setIsFlipped((f) => !f); };
  useEffect(() => { setIsFlipped(false); }, [current]);

  // Modal handlers (match Flashcard.jsx behavior)
  const openModalForIndex = (index) => {
    setCurrent(index);
    setModalFlipped(false);
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);

  // Edit handlers
  const openEdit = (index) => {
    const c = cards[index];
    if (!c) return;
    setEditIndex(index);
    setEditForm({ key_term: c.key_term || '', definition: c.definition || '' });
    setEditOpen(true);
  };
  const closeEdit = () => {
    if (savingEdit) return; // avoid closing while saving
    setEditOpen(false);
    setEditIndex(null);
  };
  const handleEditChange = (field) => (e) => setEditForm((prev) => ({ ...prev, [field]: e.target.value }));
  const saveEdit = async () => {
    if (editIndex == null) return;
    const c = cards[editIndex];
    try {
      setSavingEdit(true);
      const updated = await csvService.updateFlashcard(c.id, editForm);
      setCards((prev) => prev.map((item, i) => (i === editIndex ? { ...item, ...updated } : item)));
      setEditOpen(false);
      setEditIndex(null);
    } catch (e) {
      alert('No se pudo actualizar la flashcard: ' + (e?.response?.data?.detail || e?.message || 'Error desconocido'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (index) => {
    const c = cards[index];
    if (!c) return;
    const confirmed = window.confirm('¿Eliminar esta flashcard? Esta acción no se puede deshacer.');
    if (!confirmed) return;
    try {
      await csvService.deleteFlashcard(c.id);
      setCards((prev) => {
        const next = prev.filter((_, i) => i !== index);
        setCurrent((curr) => {
          if (curr > index) return curr - 1;
          if (curr >= next.length) return Math.max(0, next.length - 1);
          return curr;
        });
        return next;
      });
    } catch (e) {
      alert('No se pudo eliminar la flashcard: ' + (e?.response?.data?.detail || e?.message || 'Error desconocido'));
    }
  };

  // UI click sound
  const playClick = useClickSound(clickSfx, { volume: 0.3, playbackRate: 1.0 });
  const playFlip = useClickSound(flipSfx, { volume: 0.2, playbackRate: 1.0 });
  
  // Atajos de teclado (F1: prev, F2: next) para vista normal
  useEffect(() => {
    if (modalOpen) return; // evita doble manejo cuando el modal está activo
    const onKey = (e) => {
      const active = document.activeElement;
      const tag = active?.tagName?.toLowerCase();
      const isTyping = (tag === 'input' || tag === 'textarea' || active?.isContentEditable);
      if (isTyping) return;
      const key = e.key || e.code;
      if (key === 'F1') {
        e.preventDefault();
        if (current > 0) { playClick(); setCurrent(current - 1); triggerEnter('left'); }
      } else if (key === 'F2') {
        e.preventDefault();
        if (current < cards.length - 1) { playClick(); setCurrent(current + 1); triggerEnter('right'); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, current, cards.length, playClick]);

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

  // Valores derivados para animación
  const offset = anim.dir === 'right' ? 24 : anim.dir === 'left' ? -24 : 0;
  const isPrep = anim.phase === 'prep';
  const isRun = anim.phase === 'run';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', px: 3, py: 3, height: '100%', overflow: 'hidden', boxSizing: 'border-box', gap: 0 }}>
      <Box sx={{ width: '80%', maxWidth: '600px', mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
            {current + 1} of {cards.length}
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={((current + 1) / cards.length) * 100} sx={{ height: 8, borderRadius: 5, bgcolor: 'var(--color-white)', '& .MuiLinearProgress-bar': { backgroundColor: 'var(--color-success-soft)' } }} />
      </Box>
  
      <Box sx={{ position: 'relative', width: '90%', maxWidth: '500px', mb: 4 }}>
        <IconButton
          aria-label="previous card"
          onClick={() => { if (current > 0) { playClick(); prev(); } }}
          disabled={current === 0}
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
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'color-mix(in srgb, var(--color-black) 60%, transparent)' : 'color-mix(in srgb, var(--color-ink) 75%, transparent)',
            boxShadow: '0 2px 10px color-mix(in srgb, var(--color-black) 35%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-white) 6%, transparent)',
            '&:hover': {
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'color-mix(in srgb, var(--color-black) 70%, transparent)' : 'color-mix(in srgb, var(--color-ink-mid) 85%, transparent)',
            },
          }}
        >
          <ArrowBackIcon fontSize="medium" />
        </IconButton>
        <IconButton
          aria-label="next card"
          onClick={() => { if (current < cards.length - 1) { playClick(); next(); } }}
          disabled={current === cards.length - 1}
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
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'color-mix(in srgb, var(--color-black) 60%, transparent)' : 'color-mix(in srgb, var(--color-ink) 75%, transparent)',
            boxShadow: '0 2px 10px color-mix(in srgb, var(--color-black) 35%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-white) 6%, transparent)',
            '&:hover': {
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'color-mix(in srgb, var(--color-black) 70%, transparent)' : 'color-mix(in srgb, var(--color-ink-mid) 85%, transparent)',
            },
          }}
        >
          <ArrowForwardIcon fontSize="medium" />
        </IconButton>
        <Box sx={{ transition: isRun ? 'transform 200ms ease, opacity 200ms ease' : 'none', transform: isPrep ? `translateX(${offset}px)` : 'translateX(0px)', opacity: isPrep ? 0 : 1 }}>
          <FlashcardCard card={currentCard} isFlipped={isFlipped} onToggleFlip={flip} blink={false} size="md" showHint={!isFlipped} />
        </Box>
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
                  <IconButton edge="end" aria-label="edit" onClick={(e) => { e.stopPropagation(); openEdit(index); }}>
                    <EditIcon sx={{ color: 'text.secondary' }} />
                  </IconButton>
                  <IconButton edge="end" aria-label="delete" sx={{ ml: 1 }} onClick={(e) => { e.stopPropagation(); handleDelete(index); }}>
                    <DeleteIcon sx={{ color: 'text.secondary' }} />
                  </IconButton>
                </Box>
              } disablePadding selected={index === current} sx={{ py: 1.5, borderBottom: index < cards.length - 1 ? '1px solid' : 'none', borderColor: 'divider', borderRadius: 1, transition: 'background-color 120ms ease', '&:hover': { backgroundColor: (theme) => theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[200] }, '&.Mui-selected': { backgroundColor: 'action.selected' }, '&.Mui-selected:hover': { backgroundColor: 'action.selected' } }}>
                <ListItemButton onClick={() => openModalForIndex(index)} sx={{ pl: 2, pr: 14 }}>
                  <ListItemText primary={`${index + 1}. ${card.key_term}`} primaryTypographyProps={{ color: 'text.primary', noWrap: true }} />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* Modal for viewing card from overview (same style/layout as Flashcard.jsx) */}
      <FlashcardModal
        open={modalOpen}
        onClose={closeModal}
        card={currentCard}
        isFlipped={modalFlipped}
        onToggleFlip={() => { playFlip(); setModalFlipped((f) => !f); }}
        showNav
        onPrev={() => { if (current > 0) { playClick(); setCurrent(current - 1); setModalFlipped(false); } }}
        onNext={() => { if (current < cards.length - 1) { playClick(); setCurrent(current + 1); setModalFlipped(false); } }}
        disablePrev={current === 0}
        disableNext={current === cards.length - 1}
      />

      {/* Edit dialog */}
      <Dialog open={editOpen} onClose={closeEdit} fullWidth maxWidth="sm">
        <DialogTitle>Editar flashcard</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              autoFocus
              label="Keyword"
              value={editForm.key_term}
              onChange={handleEditChange('key_term')}
              fullWidth
            />
            <TextField
              label="Definition"
              value={editForm.definition}
              onChange={handleEditChange('definition')}
              fullWidth
              multiline
              minRows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit} disabled={savingEdit}>Cancelar</Button>
          <Button variant="contained" onClick={saveEdit} disabled={savingEdit} sx={{ backgroundColor: 'var(--color-success)' }}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, color: 'text.secondary' }}>
              {/* <Typography variant="caption">Shortcuts:</Typography> */}
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5, borderRadius: 999, bgcolor: 'color-mix(in srgb, var(--color-black) 6%, transparent)' }}>
                <Typography variant="caption">Press</Typography>
                <Box component="img" src={Keyf1Png} alt="Tecla 1" sx={{ height: 28, opacity: 0.85 }} />
                <Typography variant="caption">to left</Typography>
              </Box>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5, borderRadius: 999, bgcolor: 'color-mix(in srgb, var(--color-black) 6%, transparent)' }}>
                <Typography variant="caption">Press</Typography>
                <Box component="img" src={Keyf2Png} alt="Tecla 2" sx={{ height: 28, opacity: 0.85 }} />
                <Typography variant="caption">to right</Typography>
              </Box>
            </Box>
    </Box>
  );
};

export default CSVFlashcards;
