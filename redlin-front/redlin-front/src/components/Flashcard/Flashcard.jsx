import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, IconButton, LinearProgress, Divider, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { ArrowBack as ArrowBackIcon, ArrowForward as ArrowForwardIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { documentService } from '../../services/api';
import FlashcardCard from './FlashcardCard';
import FlashcardModal from './FlashcardModal';
import GearSvg from '../../assets/Gear@1x-0.2s-200px-200px (1).svg';
import useClickSound from '../../hooks/useClickSound';
import clickSfx from '../../assets/buttonclick.mp3';
import flipSfx from '../../assets/ui-pop-sound-316482.mp3';
import Keyf1Png from '../../assets/keyboard/icons8-f1-key-30.png';
import Keyf2Png from '../../assets/keyboard/icons8-f2-key-30.png';

const Flashcard = ({ documentId, refreshKey = 0 }) => {
  const [flashcards, setFlashcards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFlipped, setModalFlipped] = useState(false);

  // Estado de edición (paridad con CSVFlashcards)
  const [editOpen, setEditOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [editForm, setEditForm] = useState({ key_term: '', definition: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  // Animación (paridad con CSVFlashcards)
  const [anim, setAnim] = useState({ dir: null, phase: 'idle' }); // 'left' | 'right' | null

  // Sonidos de UI
  const playClick = useClickSound(clickSfx, { volume: 0.3, playbackRate: 1.0 });
  const playFlip = useClickSound(flipSfx, { volume: 0.2, playbackRate: 1.0 });

  // Preparar transición de entrada (modal-like)
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
  }, [documentId, refreshKey]); 

  const nextCard = () => {
    if (currentCardIndex < flashcards.length - 1) {
      playClick();
      setCurrentCardIndex(currentCardIndex + 1);
      triggerEnter('right');
    }
  };

  const previousCard = () => {
    if (currentCardIndex > 0) {
      playClick();
      setCurrentCardIndex(currentCardIndex - 1);
      triggerEnter('left');
    }
  };

  const currentCard = flashcards && flashcards.length > 0 ? flashcards[currentCardIndex] : null;

  const handleFlip = () => {
    playFlip();
    setIsFlipped((f) => !f);
  };

  const openModalForIndex = (index) => {
    setCurrentCardIndex(index);
    setModalFlipped(false);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  // Edit handlers (paridad con CSVFlashcards pero usando documentService)
  const openEdit = (index) => {
    const card = flashcards[index];
    if (!card) return;
    setEditIndex(index);
    setEditForm({ key_term: card.key_term || '', definition: card.definition || '' });
    setEditOpen(true);
  };

  const closeEdit = () => {
    if (savingEdit) return;
    setEditOpen(false);
    setEditIndex(null);
  };

  const handleEditChange = (field) => (e) => setEditForm((prev) => ({ ...prev, [field]: e.target.value }));

  const saveEdit = async () => {
    if (editIndex == null) return;
    const card = flashcards[editIndex];
    try {
      setSavingEdit(true);
      const updated = await documentService.updateFlashcard(card.id, editForm);
      setFlashcards((prev) => prev.map((item, i) => (i === editIndex ? { ...item, ...updated } : item)));
      setEditOpen(false);
      setEditIndex(null);
    } catch (e) {
      alert('No se pudo actualizar la flashcard: ' + (e?.response?.data?.detail || e?.message || 'Error desconocido'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (index) => {
    const card = flashcards[index];
    if (!card) return;
    const confirmed = window.confirm('¿Eliminar esta flashcard? Esta acción no se puede deshacer.');
    if (!confirmed) return;
    try {
      await documentService.deleteFlashcard(card.id);
      setFlashcards((prev) => {
        const next = prev.filter((_, i) => i !== index);
        setCurrentCardIndex((curr) => {
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

  // (Review 1/2/3 no aplica en la vista de Flashcards; se usa en la pestaña Review)

  // No hay toggling de review en la UI de Flashcards (paridad con CSVFlashcards)

  React.useEffect(() => {
    setIsFlipped(false);
  }, [currentCardIndex]);

  // Atajos de teclado (F1/F2) en vista normal, igual que CSVFlashcards
  useEffect(() => {
    if (modalOpen) return;
    const onKey = (e) => {
      const active = document.activeElement;
      const tag = active?.tagName?.toLowerCase();
      const isTyping = (tag === 'input' || tag === 'textarea' || active?.isContentEditable);
      if (isTyping) return;
      const key = e.key || e.code;
      if (key === 'F1') {
        e.preventDefault();
        if (currentCardIndex > 0) { playClick(); setCurrentCardIndex(currentCardIndex - 1); triggerEnter('left'); }
      } else if (key === 'F2') {
        e.preventDefault();
        if (currentCardIndex < flashcards.length - 1) { playClick(); setCurrentCardIndex(currentCardIndex + 1); triggerEnter('right'); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, currentCardIndex, flashcards.length, playClick]);

  // (Atajos 1/2/3 removidos en Flashcards; mantener solo F1/F2)

  // Derivados para animación
  const offset = anim.dir === 'right' ? 24 : anim.dir === 'left' ? -24 : 0;
  const isPrep = anim.phase === 'prep';
  const isRun = anim.phase === 'run';

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
  // console.log('Current Card Data:', currentCard);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', px: 1, py: 2, height: '100%', overflow: 'hidden', boxSizing: 'border-box', gap: 0 }}>
      {/* Progress Indicator */}
      <Box sx={{ width: '80%', maxWidth: '600px', mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
            {currentCardIndex + 1} of {flashcards.length}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={(currentCardIndex + 1) / flashcards.length * 100}
          sx={{
            height: 8,
            borderRadius: 5,
            bgcolor: '#fff',
            '& .MuiLinearProgress-bar': { backgroundColor: '#acf3d0' },
          }}
        />
      </Box>

  <Box sx={{ position: 'relative', width: '92%', maxWidth: '520px', mb: 3 }}>
        <IconButton
          aria-label="previous card"
          onClick={previousCard}
          disabled={currentCardIndex === 0}
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
          onClick={nextCard}
          disabled={currentCardIndex === flashcards.length - 1}
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
        <Box sx={{ transition: isRun ? 'transform 200ms ease, opacity 200ms ease' : 'none', transform: isPrep ? `translateX(${offset}px)` : 'translateX(0px)', opacity: isPrep ? 0 : 1 }}>
          <FlashcardCard card={currentCard} isFlipped={isFlipped} onToggleFlip={handleFlip} blink={false} size="md" showHint={!isFlipped} />
        </Box>
      </Box>

      <Divider sx={{ width: '92%', maxWidth: '640px', my: 2 }} />
      {/* Card Overview grid (new style) */}
      <Box sx={{ width: '92%', maxWidth: '640px', mb: 2 }}>
        <div className="card-overview-wrapper">
          <div className="card-overview-header">
            <div className="card-overview-title">Card Overview</div>
            <div className="card-overview-viewall" onClick={() => openModalForIndex(currentCardIndex)}>View Current</div>
          </div>
          <div className="card-grid" style={{ maxHeight: '28vh', overflowY: 'auto' }}>
            {flashcards.map((card, index) => {
              const preview = (card.definition || '').slice(0, 60) + ((card.definition || '').length > 60 ? '…' : '');
              return (
                <div
                  key={card.id || `mini-${index}`}
                  className={`card-mini ${index === currentCardIndex ? 'active' : ''}`}
                  onClick={() => openModalForIndex(index)}
                >
                  <div className="card-mini-title">{card.key_term}</div>
                  <div className="card-mini-preview">{preview}</div>
                  <div className="card-mini-actions">
                    <div
                      className="card-mini-action-btn"
                      title="Edit"
                      onClick={(e) => { e.stopPropagation(); openEdit(index); }}
                    >
                      <EditIcon sx={{ fontSize: 14 }} />
                    </div>
                    <div
                      className="card-mini-action-btn"
                      title="Delete"
                      onClick={(e) => { e.stopPropagation(); handleDelete(index); }}
                    >
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Box>

      {/* Modal con navegación (paridad con CSV) */}
      <FlashcardModal
        open={modalOpen}
        onClose={closeModal}
        card={currentCard}
        isFlipped={modalFlipped}
        onToggleFlip={() => { playFlip(); setModalFlipped((f) => !f); }}
        showNav
        onPrev={() => { if (currentCardIndex > 0) { playClick(); setCurrentCardIndex(currentCardIndex - 1); setModalFlipped(false); } }}
        onNext={() => { if (currentCardIndex < flashcards.length - 1) { playClick(); setCurrentCardIndex(currentCardIndex + 1); setModalFlipped(false); } }}
        disablePrev={currentCardIndex === 0}
        disableNext={currentCardIndex === flashcards.length - 1}
      />

      {/* Diálogo de edición (paridad con CSV) */}
      <Dialog open={editOpen} onClose={closeEdit} fullWidth maxWidth="sm">
        <DialogTitle>Editar flashcard</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField autoFocus label="Keyword" value={editForm.key_term} onChange={handleEditChange('key_term')} fullWidth />
            <TextField label="Definition" value={editForm.definition} onChange={handleEditChange('definition')} fullWidth multiline minRows={3} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit} disabled={savingEdit}>Cancelar</Button>
          <Button variant="contained" onClick={saveEdit} disabled={savingEdit} sx={{ backgroundColor: '#6be0a6' }}>Guardar</Button>
        </DialogActions>
      </Dialog>

      {/* Helper de atajos F1/F2 */}
      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, color: 'text.secondary' }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5, borderRadius: 999, bgcolor: 'rgba(0,0,0,0.06)' }}>
          <Typography variant="caption">Press</Typography>
          <Box component="img" src={Keyf1Png} alt="Tecla F1" sx={{ height: 28, opacity: 0.85 }} />
          <Typography variant="caption">to left</Typography>
        </Box>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5, borderRadius: 999, bgcolor: 'rgba(0,0,0,0.06)' }}>
          <Typography variant="caption">Press</Typography>
          <Box component="img" src={Keyf2Png} alt="Tecla F2" sx={{ height: 28, opacity: 0.85 }} />
          <Typography variant="caption">to right</Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default Flashcard;
