import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Box, Tabs, Tab, Typography, Button, Chip } from '@mui/material';
import FlashcardCard from '../../components/Flashcard/FlashcardCard';
import CSVFlashcards from '../../components/CSV/CSVFlashcards';
import { csvService } from '../../services/api/csv';
import { alpha } from '@mui/material/styles';
import { keyframes } from '@mui/system';
import BackHandIcon from '@mui/icons-material/BackHand';
import useClickSound from '../../hooks/useClickSound';
import clickSfx from '../../assets/buttonclick.mp3';
import flipSfx from '../../assets/ui-pop-sound-316482.mp3';
import dropSfx from '../../assets/drop_card.mp3';
import Key1Png from '../../assets/keyboard/icons8-1-key-30.png';
import Key2Png from '../../assets/keyboard/icons8-2-key-30.png';
import Key3Png from '../../assets/keyboard/icons8-3-key-30.png';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

// Small animation helpers
const pulse = keyframes`
  0% { transform: scale(1); opacity: .5; }
  100% { transform: scale(1.08); opacity: 0; }
`;

const popIn = keyframes`
  0% { transform: scale(.95); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
`;

const glow = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.0); }
  100% { box-shadow: 0 0 0 6px rgba(255,255,255,0); }
`;

const CSVStudy = () => {
  const { csvSlug } = useParams();
  const query = useQuery();
  const importId = query.get('importId');

  const [activeTab, setActiveTab] = useState(0); // 0: Flashcards, 1: Review
  const [studyBatch, setStudyBatch] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState({}); // { [cardId]: 'hard'|'medium'|'easy' }
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOver, setDragOver] = useState(null); // 'hard' | 'medium' | 'easy' | null
  const [lastDroppedId, setLastDroppedId] = useState(null);
  const [isReviewActive, setIsReviewActive] = useState(false);
  const [cardFlipped, setCardFlipped] = useState(false);
  const dragActiveRef = useRef(false);

  // UI click sound for key buttons
  const playClick = useClickSound(clickSfx, { volume: 0.3, playbackRate: 1.0 });
  // Flip sound only when user clicks to flip the card
  const playFlip = useClickSound(flipSfx, { volume: 0.2, playbackRate: 1.0 });
  // Drop sound when a card/chip is dropped into a bucket
  const playDrop = useClickSound(dropSfx, { volume: 0.3, playbackRate: 1.0 });

  const reloadAll = async () => {
    setLoading(true);
    try {
      const study = await csvService.studyBatch({ sourceId: importId, limit: 20 });
      setStudyBatch(Array.isArray(study) ? shuffle(study) : []);
      setCurrentIdx(0);
      setIsReviewActive(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (importId) reloadAll();
  }, [importId]);

  const currentStudy = studyBatch[currentIdx] || null;

  // Reset flip when the current card changes
  useEffect(() => {
    setCardFlipped(false);
  }, [currentStudy?.id]);

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const advanceToNextUnassigned = useCallback(() => {
    if (!studyBatch.length) { setCurrentIdx(0); return; }
    const total = studyBatch.length;
    for (let offset = 1; offset <= total; offset++) {
      const next = (currentIdx + offset) % total;
      const id = studyBatch[next]?.id;
      if (id != null && !assignments[id]) { setCurrentIdx(next); return; }
    }
  }, [studyBatch, currentIdx, assignments]);

  const bucketItems = useMemo(() => ({
    hard: studyBatch.filter((c) => assignments[c.id] === 'hard'),
    medium: studyBatch.filter((c) => assignments[c.id] === 'medium'),
    easy: studyBatch.filter((c) => assignments[c.id] === 'easy'),
  }), [assignments, studyBatch]);

  const onDragStart = (e) => {
    if (!currentStudy) return;
    e.dataTransfer.setData('text/plain', String(currentStudy.id));
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
    setLastDroppedId(null);
    dragActiveRef.current = true;
  };

  const onDragEnd = () => {
    setIsDragging(false);
    // release after tick so a click immediately after drag doesn't flip
    setTimeout(() => { dragActiveRef.current = false; }, 0);
  };

  // Allow re-dragging of assigned items (chips)
  const handleChipDragStart = (id) => (e) => {
    e.dataTransfer.setData('text/plain', String(id));
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
    setLastDroppedId(null);
  };

  const handleChipDragEnd = () => { setIsDragging(false); };

  const handleDropTo = (bucket) => (e) => {
    e.preventDefault();
    const idStr = e.dataTransfer.getData('text/plain');
    const id = parseInt(idStr, 10);
    if (!id) return;
    playDrop();
    setAssignments((prev) => ({ ...prev, [id]: bucket }));
    setLastDroppedId(id);
    setDragOver(null);
    setIsDragging(false);
    advanceToNextUnassigned();
  };

  const allowDrop = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const resetReview = () => { setAssignments({}); setCurrentIdx(0); setCardFlipped(false); };

  const canSubmit = studyBatch.length > 0 && Object.keys(assignments).length === studyBatch.length && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const qualityMap = { hard: 2, medium: 4, easy: 5 };
      // Submit in parallel but capped would be nicer; for now simple Promise.all
      await Promise.all(
        studyBatch.map((card) => {
          const bucket = assignments[card.id];
          const quality = qualityMap[bucket] ?? 4;
          return csvService.reviewCard(card.id, quality);
        })
      );
      // Refresh a new due batch after submit
      await reloadAll();
      setAssignments({});
    } catch (e) {
      console.error('Submit reviews failed', e);
    } finally {
      setSubmitting(false);
    }
  };

  const review = async (quality) => {
    if (!currentStudy) return;
    try {
      await csvService.reviewCard(currentStudy.id, quality);
      const next = await csvService.studyBatch({ sourceId: importId, limit: 1 });
      // Replace current with new due card (or move forward)
      const updated = [...studyBatch];
      updated[currentIdx] = next[0] || updated[currentIdx];
      setStudyBatch(updated);
      setCurrentIdx((i) => (i + 1) % updated.length);
    } catch (e) {
      console.error('Review failed', e);
    }
  };

  // Keyboard shortcuts: 1 (hard), 2 (medium), 3 (easy) in Review section only
  useEffect(() => {
    if (activeTab !== 1 || !isReviewActive) return;
    const onKey = (e) => {
      const activeEl = document.activeElement;
      const tag = activeEl?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || activeEl?.isContentEditable) return;
      let bucket = null;
      if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') bucket = 'hard';
      else if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') bucket = 'medium';
      else if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') bucket = 'easy';
      if (bucket && currentStudy?.id) {
        e.preventDefault();
        playDrop();
        setAssignments((prev) => ({ ...prev, [currentStudy.id]: bucket }));
        setLastDroppedId(currentStudy.id);
        setDragOver(null);
        setIsDragging(false);
        advanceToNextUnassigned();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTab, isReviewActive, currentStudy?.id, advanceToNextUnassigned, playDrop]);

  return (
    <Box sx={{ width: '100%', maxWidth: '1000px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', width: '100%', flexShrink: 0 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e,v)=>setActiveTab(v)} 
          textColor="inherit" 
          centered
          sx={{ 
            '& .MuiTabs-indicator': { backgroundColor: '#ffffff' },
            '& .MuiTabs-flexContainer': { justifyContent: 'center' }
          }}
        >
          <Tab label="Flashcards" sx={{ fontWeight: 900, color: '#000000', '&.Mui-selected': { color: '#fff' } }} />
          <Tab label="Review" sx={{ fontWeight: 900, color: '#000000', '&.Mui-selected': { color: '#fff' } }} />
        </Tabs>
      </Box>
      <Box sx={{ flexGrow: 1, overflowY: 'auto', width: '100%', display: 'flex', flexDirection: 'column', p: 3 }}>
        {activeTab === 0 && (
          <CSVFlashcards sourceId={importId} />
        )}
        {activeTab === 1 && !isReviewActive && (
          <Box 
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              p: 4,
              height: '100%',
              textAlign: 'center',
              pt: 2,
              width: '100%',
              maxWidth: '600px',
              mx: 'auto'
            }}
          >
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
              Review Your Study Cards
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: '500px' }}>
              {studyBatch.length > 0 
                ? `Ready? You have ${studyBatch.length} cards to sort.`
                : `No cards due right now.`}
            </Typography>
            <Button 
              variant="contained" 
              size="large" 
              onClick={() => { playClick(); setIsReviewActive(true); }} 
              disabled={studyBatch.length === 0}
              sx={{ backgroundColor: '#000', borderRadius: '20px' }}
            >
              {studyBatch.length > 0 ? 'Start Review' : 'No Cards Due'}
            </Button>
          </Box>
        )}
        {activeTab === 1 && isReviewActive && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Drag the card into a bucket. Buckets: Hard, Medium, Easy. Submit when you’ve sorted all cards.
            </Typography>

            {/* Draggable Card */}
            <Box sx={{ width: '100%', maxWidth: 520, position: 'relative', mb: '30px' }}>
              {currentStudy ? (
                <Box
                  draggable
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onClick={() => { if (!dragActiveRef.current) { playFlip(); setCardFlipped((f) => !f); } }}
                  sx={{
                    position: 'relative',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    '&:active': { cursor: 'grabbing' },
                    transition: 'transform 0.2s ease, filter 0.2s ease',
                    transform: isDragging ? 'scale(1.04) rotateZ(0.4deg)' : 'none',
                    filter: isDragging ? 'drop-shadow(0 8px 24px rgba(0,0,0,0.35))' : 'none',
                    '&:hover .grabOverlay': { opacity: 1, transform: 'translate(-50%, 0)' },
                  }}
                >
                  <FlashcardCard
                    card={currentStudy}
                    isFlipped={cardFlipped}
                    // Let the wrapper handle click-to-flip so drag doesn't conflict
                    onToggleFlip={undefined}
                    size="md"
                    showHint={!cardFlipped}
                  />
                  {/* Hover helper */}
                  <Box
                    className="grabOverlay"
                    sx={{
                      position: 'absolute',
                      left: '50%',
                      bottom: 40,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                      opacity: 0,
                      transform: 'translate(-50%, 6px)',
                      transition: 'opacity .2s ease, transform .2s ease',
                    }}
                  >
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.5, borderRadius: 999, bgcolor: 'rgba(0,0,0,0.55)', color: '#fff', backdropFilter: 'blur(4px)', fontSize: 12 }}>
                      <BackHandIcon sx={{ fontSize: 16 }} /> Drag to sort
                    </Box>
                  </Box>
                  {/* Drag pulse ring */}
                  {isDragging && (
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: -8,
                        borderRadius: '24px',
                        border: '2px solid',
                        borderColor: 'primary.main',
                        opacity: 0.5,
                        animation: `${pulse} 900ms ease-out infinite`,
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                </Box>
              ) : (
                <Typography color="text.secondary">No cards due right now.</Typography>
              )}
            </Box>

            {/* Drop Bins - Minimal neutral style */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, width: '100%', maxWidth: 820 }}>
              {[{ key: 'hard', label: 'Hard' }, { key: 'medium', label: 'Medium' }, { key: 'easy', label: 'Easy' }].map(({ key, label }) => (
                <Box
                  key={key}
                  onDragOver={allowDrop}
                  onDragEnter={() => setDragOver(key)}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={handleDropTo(key)}
                  sx={(theme) => {
                    const active = dragOver === key;
                    return {
                      p: 2,
                      border: '1.5px dashed #000',
                      // borderColor: theme.palette.divider,
                      borderRadius: 2,
                      minHeight: 140,
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      transition: 'transform .2s ease, box-shadow .2s ease, background .2s ease, border-color .2s ease',
                      bgcolor: 'transparent',
                      boxShadow: active ? '0 6px 20px rgba(0,0,0,0.06)' : 'none',
                      transform: active ? 'translateY(-2px)' : 'none',
                      outline: active ? `2px solid ${alpha(theme.palette.text.primary, 0.15)}` : 'none',
                      outlineOffset: '-2px',
                    };
                  }}
                >
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontWeight: 700, color: '#000' }}>{label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {bucketItems[key].length} assigned
                    </Typography>
                  </Box>
                  {bucketItems[key].length === 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      Drag here
                    </Typography>
                  )}
                  <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', width: '100%' }}>
                    {bucketItems[key].map((c) => (
                      <Chip
                        key={c.id}
                        size="small"
                        label={c.key_term || 'N/A'}
                        draggable
                        onDragStart={handleChipDragStart(c.id)}
                        onDragEnd={handleChipDragEnd}
                        sx={(theme) => ({
                          cursor: isDragging ? 'grabbing' : 'grab',
                          animation: c.id === lastDroppedId ? `${popIn} 250ms ease-out` : 'none',
                          bgcolor: alpha(theme.palette.background.paper, 0.5),
                          border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                        })}
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>

            {/* Keyboard shortcuts helper */}
            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, color: 'text.secondary' }}>
              {/* <Typography variant="caption">Shortcuts:</Typography> */}
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5, borderRadius: 999, bgcolor: 'rgba(0,0,0,0.06)' }}>
                <Typography variant="caption">Press</Typography>
                <Box component="img" src={Key1Png} alt="Tecla 1" sx={{ height: 28, opacity: 0.85 }} />
                <Typography variant="caption">to set as Hard</Typography>
              </Box>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5, borderRadius: 999, bgcolor: 'rgba(0,0,0,0.06)' }}>
                <Typography variant="caption">Press</Typography>
                <Box component="img" src={Key2Png} alt="Tecla 2" sx={{ height: 28, opacity: 0.85 }} />
                <Typography variant="caption">to set as Medium</Typography>
              </Box>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5, borderRadius: 999, bgcolor: 'rgba(0,0,0,0.06)' }}>
                <Typography variant="caption">Press</Typography>
                <Box component="img" src={Key3Png} alt="Tecla 3" sx={{ height: 28, opacity: 0.85 }} />
                <Typography variant="caption">to set as Easy</Typography>
              </Box>
            </Box>

            {/* Footer actions */}
            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <Button variant="contained" onClick={() => { playClick(); resetReview(); }} disabled={submitting} sx={{ backgroundColor: '#000' }}>Reset</Button>
              <Button variant="contained" onClick={() => { playClick(); handleSubmit(); }} disabled={!canSubmit} sx={{ backgroundColor: '#6be0a6' }}>
                {submitting ? 'Submitting…' : 'Submit Reviews'}
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Sorted {Object.keys(assignments).length} / {studyBatch.length}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default CSVStudy;
