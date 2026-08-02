import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Chip, Tab, Tabs, Typography } from '@mui/material';
import FlashcardCard from './FlashcardCard';
import { documentService } from '../../services/api';
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

const pulse = keyframes`
  0% { transform: scale(1); opacity: .5; }
  100% { transform: scale(1.08); opacity: 0; }
`;

const popIn = keyframes`
  0% { transform: scale(.95); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
`;

const DocReview = ({ documentId, onReviewChange = () => {} }) => {
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

  const playClick = useClickSound(clickSfx, { volume: 0.3, playbackRate: 1.0 });
  const playFlip = useClickSound(flipSfx, { volume: 0.2, playbackRate: 1.0 });
  const playDrop = useClickSound(dropSfx, { volume: 0.3, playbackRate: 1.0 });

  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const reloadAll = async () => {
    if (!documentId) { setStudyBatch([]); setIsReviewActive(false); return; }
    setLoading(true);
    try {
      const study = await documentService.studyBatch({ documentId, limit: 20 });
      setStudyBatch(Array.isArray(study) ? shuffle(study) : []);
      setCurrentIdx(0);
      setIsReviewActive(false);
      setAssignments({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reloadAll(); }, [documentId]);

  const currentStudy = studyBatch[currentIdx] || null;

  useEffect(() => { setCardFlipped(false); }, [currentStudy?.id]);

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
    setTimeout(() => { dragActiveRef.current = false; }, 0);
  };

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
      await Promise.all(
        studyBatch.map((card) => {
          const bucket = assignments[card.id];
          const quality = qualityMap[bucket] ?? 4;
          return documentService.reviewCard(card.id, quality);
        })
      );
      await reloadAll();
      setAssignments({});
      // Notify parent so Flashcards list can refresh and reflect new ordering
      try { onReviewChange(); } catch (_) {}
    } catch (e) {
      console.error('Submit reviews failed', e);
    } finally {
      setSubmitting(false);
    }
  };

  const review = async (quality) => {
    if (!currentStudy) return;
    try {
      await documentService.reviewCard(currentStudy.id, quality);
      // Notify parent immediately after a single review so Flashcards can re-fetch
      try { onReviewChange(); } catch (_) {}
      const next = await documentService.studyBatch({ documentId, limit: 1 });
      const updated = [...studyBatch];
      updated[currentIdx] = next[0] || updated[currentIdx];
      setStudyBatch(updated);
      setCurrentIdx((i) => (i + 1) % updated.length);
    } catch (e) {
      console.error('Review failed', e);
    }
  };

  // Atajos 1/2/3 dentro de Review activo
  useEffect(() => {
    if (!isReviewActive) return;
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
  }, [isReviewActive, currentStudy?.id, advanceToNextUnassigned, playDrop]);

  return (
    <Box sx={{ width: '100%', maxWidth: '1000px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {!documentId && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
          <Typography color="text.secondary">Selecciona un documento para revisar tarjetas.</Typography>
        </Box>
      )}

      {documentId && !isReviewActive && (
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
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'var(--color-white)' }}>
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
            disabled={studyBatch.length === 0 || loading}
            sx={{
              backgroundColor: 'var(--color-success)', color: 'var(--color-navy-deep)',
              borderRadius: '999px', px: 4, fontWeight: 700,
              '&:hover': { backgroundColor: 'var(--color-teal-pale)' },
            }}
          >
            {studyBatch.length > 0 ? 'Start Review' : 'No Cards Due'}
          </Button>
        </Box>
      )}

      {documentId && isReviewActive && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Drag the card into a bucket. Buckets: Hard, Medium, Easy. Submit when you’ve sorted all cards.
          </Typography>

          {/* Tarjeta draggable */}
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
                  filter: isDragging ? 'drop-shadow(0 8px 24px color-mix(in srgb, var(--color-black) 35%, transparent))' : 'none',
                  '&:hover .grabOverlay': { opacity: 1, transform: 'translate(-50%, 0)' },
                }}
              >
                <FlashcardCard
                  card={currentStudy}
                  isFlipped={cardFlipped}
                  onToggleFlip={undefined}
                  size="md"
                  showHint={!cardFlipped}
                />
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
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.5, borderRadius: 999, bgcolor: 'color-mix(in srgb, var(--color-black) 55%, transparent)', color: 'var(--color-white)', backdropFilter: 'blur(4px)', fontSize: 12 }}>
                    <BackHandIcon sx={{ fontSize: 16 }} /> Drag to sort
                  </Box>
                </Box>
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

          {/* Buckets minimal neutrales */}
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
                    border: '1.5px dashed var(--color-black)',
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
                    boxShadow: active ? '0 6px 20px color-mix(in srgb, var(--color-black) 6%, transparent)' : 'none',
                    transform: active ? 'translateY(-2px)' : 'none',
                    outline: active ? `2px solid ${alpha(theme.palette.text.primary, 0.15)}` : 'none',
                    outlineOffset: '-2px',
                  };
                }}
              >
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontWeight: 700, color: 'var(--color-white)' }}>{label}</Typography>
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

          {/* Acciones */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
            <Button variant="outlined" onClick={() => { playClick(); resetReview(); }} disabled={submitting}>Reset</Button>
            <Button variant="contained" onClick={() => { playClick(); handleSubmit(); }} disabled={!canSubmit} sx={{ backgroundColor: 'var(--color-black)' }}>
              {submitting ? 'Submitting...' : 'Submit Reviews'}
            </Button>
          </Box>

          {/* Helper de atajos 1/2/3 debajo de buckets */}
          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, color: 'text.secondary' }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5, borderRadius: 999, bgcolor: 'color-mix(in srgb, var(--color-black) 6%, transparent)' }}>
              <Typography variant="caption">Press</Typography>
              <Box component="img" src={Key1Png} alt="Key 1" sx={{ height: 28, opacity: 0.85 }} />
              <Typography variant="caption">to send to Hard</Typography>
            </Box>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5, borderRadius: 999, bgcolor: 'color-mix(in srgb, var(--color-black) 6%, transparent)' }}>
              <Typography variant="caption">Press</Typography>
              <Box component="img" src={Key2Png} alt="Key 2" sx={{ height: 28, opacity: 0.85 }} />
              <Typography variant="caption">to send to Medium</Typography>
            </Box>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5, borderRadius: 999, bgcolor: 'color-mix(in srgb, var(--color-black) 6%, transparent)' }}>
              <Typography variant="caption">Press</Typography>
              <Box component="img" src={Key3Png} alt="Key 3" sx={{ height: 28, opacity: 0.85 }} />
              <Typography variant="caption">to send to Easy</Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default DocReview;
