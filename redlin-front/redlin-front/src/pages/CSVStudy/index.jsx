import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { Box, Tabs, Tab, Typography, Button } from '@mui/material';
import WavyBackground from '../../components/common/WavyBackground';
import MiniDrawer from '../Dashboard/Sidebar';
import FlashcardCard from '../../components/Flashcard/FlashcardCard';
import CSVFlashcards from '../../components/CSV/CSVFlashcards';
import { csvService } from '../../services/api/csv';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const CSVStudy = () => {
  const { csvSlug } = useParams();
  const navigate = useNavigate();
  const query = useQuery();
  const importId = query.get('importId');

  const [activeTab, setActiveTab] = useState(0); // 0: Flashcards, 1: Review
  const [studyBatch, setStudyBatch] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState({}); // { [cardId]: 'hard'|'medium'|'easy' }
  const [submitting, setSubmitting] = useState(false);

  const reloadAll = async () => {
    setLoading(true);
    try {
      const study = await csvService.studyBatch({ sourceId: importId, limit: 20 });
      setStudyBatch(Array.isArray(study) ? shuffle(study) : []);
      setCurrentIdx(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (importId) reloadAll();
  }, [importId]);

  const currentStudy = studyBatch[currentIdx] || null;

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

  const onDragStart = (e) => {
    if (!currentStudy) return;
    e.dataTransfer.setData('text/plain', String(currentStudy.id));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropTo = (bucket) => (e) => {
    e.preventDefault();
    const idStr = e.dataTransfer.getData('text/plain');
    const id = parseInt(idStr, 10);
    if (!id) return;
    setAssignments((prev) => ({ ...prev, [id]: bucket }));
    advanceToNextUnassigned();
  };

  const allowDrop = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const resetReview = () => { setAssignments({}); setCurrentIdx(0); };

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

  return (
    <Box sx={{ position: 'relative', display: 'flex', height: '100vh', bgcolor: 'transparent' }}>
      <WavyBackground waveHeight="60vh" offsetY={0} />
      <MiniDrawer />
      <Box sx={{ position: 'relative', zIndex: 1, flexGrow: 1, pl: '0px', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflow: 'hidden', pt: 2 }}>
        <Box sx={{ width: '100%', maxWidth: '1000px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', width: '100%', flexShrink: 0 }}>
            <Tabs value={activeTab} onChange={(e,v)=>setActiveTab(v)} centered textColor="inherit" sx={{ '& .MuiTabs-indicator': { backgroundColor: '#ffffff' } }}>
              <Tab label="Flashcards" sx={{ fontWeight: 900, color: '#000000', '&.Mui-selected': { color: '#fff' } }} />
              <Tab label="Review" sx={{ fontWeight: 900, color: '#000000', '&.Mui-selected': { color: '#fff' } }} />
            </Tabs>
          </Box>
          <Box sx={{ flexGrow: 1, overflowY: 'auto', width: '100%', display: 'flex', flexDirection: 'column', p: 3 }}>
            {activeTab === 0 && (
              <CSVFlashcards sourceId={importId} />
            )}
            {activeTab === 1 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  Drag the card into a bucket. Buckets: Hard, Medium, Easy. Submit when you’ve sorted all cards.
                </Typography>

                {/* Draggable Card */}
                <Box sx={{ width: '100%', maxWidth: 520 }}>
                  {currentStudy ? (
                    <Box draggable onDragStart={onDragStart} sx={{ cursor: 'grab' }}>
                      <FlashcardCard card={currentStudy} isFlipped={false} onToggleFlip={()=>{}} size="md" />
                    </Box>
                  ) : (
                    <Typography color="text.secondary">No cards due right now.</Typography>
                  )}
                </Box>

                {/* Drop Bins */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, width: '100%', maxWidth: 820 }}>
                  {[{key:'hard',label:'Hard',color:'error.main'}, {key:'medium',label:'Medium',color:'warning.main'}, {key:'easy',label:'Easy',color:'success.main'}].map(({key,label,color}) => (
                    <Box key={key} onDragOver={allowDrop} onDrop={handleDropTo(key)}
                      sx={{ p: 2, border: '2px dashed', borderColor: color, borderRadius: 2, minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.04)' }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ fontWeight: 700 }}>{label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {Object.values(assignments).filter(v=>v===key).length} assigned
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>

                {/* Footer actions */}
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <Button variant="outlined" onClick={resetReview} disabled={submitting}>Reset</Button>
                  <Button variant="contained" onClick={handleSubmit} disabled={!canSubmit}>
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
      </Box>
    </Box>
  );
};

export default CSVStudy;
