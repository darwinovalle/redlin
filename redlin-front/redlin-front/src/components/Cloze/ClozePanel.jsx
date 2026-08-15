import React, { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, Stack } from '@mui/material';
import GearSvg from '../../assets/Gear@1x-0.2s-200px-200px (1).svg';
import { clozeService } from '../../services/api/cloze.jsx';
import { srService } from '../../services/api/sr';
import { useStudySection } from '../../hooks/useStudySession';
import ClozeCard from './ClozeCard';
import FocusToggle from '../common/FocusToggle';
import dinoStudy from '../../assets/redlin_logo/dino_study.png';

/**
 * ClozePanel lists clozes for a selected document and allows validation.
 * Props:
 *  - documentId
 */
const ClozePanel = ({ documentId, focus = false, autoStart = false, showStudyImage = false, onStart, onFocusChange }) => {
  // Section timer: attribute Cloze practice time to this document source.
  
  const [clozes, setClozes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [started, setStarted] = useState(false);
  const [sessionKey, setSessionKey] = useState(null); // changes each time user starts practice
  const [answeredMap, setAnsweredMap] = useState({}); // { clozeId: true|false }
  // Progressive loading: clozes are fetched a page at a time.
  const [clozePage, setClozePage] = useState(1);
  const [clozeTotal, setClozeTotal] = useState(0);
  const [clozeHasMore, setClozeHasMore] = useState(false);
  useStudySection({ model: 'document', itemId: documentId, method: 'CLOZE', active: started && !(Object.keys(answeredMap).length >= clozes.length && !clozeHasMore) });
  const [loadingMore, setLoadingMore] = useState(false);

  // Simple Fisher-Yates shuffle
  const shuffle = useCallback((arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, []);

  const load = useCallback(async () => {
    if (!documentId) { setClozes([]); setClozeTotal(0); setClozeHasMore(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { results, count, hasMore } = await clozeService.listDocumentClozesPage(documentId, 1);
      setClozes(results || []);
      setClozeTotal(count ?? (results || []).length);
      setClozeHasMore(hasMore);
      setClozePage(1);
    } catch (e) {
      setError(e?.detail || e?.error || 'Failed to load clozes');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  const loadMore = useCallback(async () => {
    if (!documentId || loadingMore || !clozeHasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = clozePage + 1;
      const { results, count, hasMore } = await clozeService.listDocumentClozesPage(documentId, nextPage);
      setClozes((prev) => [...prev, ...(results || [])]);
      setClozeTotal(count ?? (results || []).length);
      setClozeHasMore(hasMore);
      setClozePage(nextPage);
    } catch (e) {
      setError(e?.detail || e?.error || 'Failed to load more clozes');
    } finally {
      setLoadingMore(false);
    }
  }, [documentId, loadingMore, clozeHasMore, clozePage]);

  useEffect(() => { load(); }, [load]);
  // Reset start gate when document changes
  useEffect(() => { setStarted(false); }, [documentId]);
  useEffect(() => { setAnsweredMap({}); }, [sessionKey]);

  // Focus Mode: when rendered inside the focus popup, begin immediately.
  useEffect(() => {
    if (autoStart && clozes.length) {
      setSessionKey(Date.now());
      setStarted(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, clozes.length]);

  const handleValidate = async ({ clozeId, answer }) => {
    return clozeService.validate({ clozeId, answer, type: 'document' });
  };

  if (!documentId) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>Please select a document to view cloze exercises.</Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <img src={GearSvg} alt="Loading" width={30} height={30} />
        <Typography sx={{ ml: 2, color: 'var(--color-white)' }}>Loading Clozes...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography sx={{ color: 'var(--color-danger-softer)' }}>Error: {error}</Typography>
      </Box>
    );
  }

  if (!clozes || clozes.length === 0) {
    return (
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', height: '100%', textAlign: 'center' }}>
        <Typography sx={{ maxWidth: 480, color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>
          This document doesn't have Cloze exercises enabled yet. Generate Clozes in the backend or check back later.
        </Typography>
      </Box>
    );
  }

  // Intro gate (similar to Review / Quiz start screen)
  if (!started) {
    return (
      <Box sx={{ textAlign: 'center', p: 3, maxWidth: 760, mx: 'auto' }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h4" sx={{ mb: 0.5, fontWeight: 700, color: 'var(--color-white)' }}>
            Cloze Practice
          </Typography>
          <Typography variant="body1" sx={{ mb: 1.5, color: 'color-mix(in srgb, var(--color-white) 72%, transparent)', maxWidth: 520 }}>
            Ready? This set contains {clozeTotal || clozes.length} cloze {(clozeTotal || clozes.length) === 1 ? 'item' : 'items'}. Fill in the blanks accurately.
          </Typography>
          <Button
            variant="contained"
            size="large"
            disabled={!clozes.length}
            onClick={() => { if (focus) onStart?.(); else { setClozes((prev) => shuffle(prev)); setSessionKey(Date.now()); setStarted(true); } }}
            sx={{
              borderRadius: '999px',
              backgroundColor: 'var(--color-success)',
              color: 'var(--color-navy-deep)',
              px: 4,
              fontWeight: 700,
              boxShadow: '0 18px 40px color-mix(in srgb, var(--color-success) 24%, transparent)',
              '&:hover': { backgroundColor: 'var(--color-teal-pale)' },
              '&.Mui-disabled': { bgcolor: 'color-mix(in srgb, var(--color-white) 8%, transparent)', color: 'color-mix(in srgb, var(--color-white) 36%, transparent)' },
            }}
          >
            Start Cloze Practice
          </Button>
          <FocusToggle focus={focus} onChange={onFocusChange} />
          {showStudyImage && (
            <img src={dinoStudy} alt="Start studying" style={{ width: 'auto', height: 300, maxWidth: '100%', objectFit: 'contain', display: 'block', margin: '20px auto 0' }} />
          )}
        </Stack>
      </Box>
    );
  }

  const total = clozes.length;
  const answeredIds = Object.keys(answeredMap);
  const answeredCount = answeredIds.length;
  const correctCount = answeredIds.reduce((acc, id) => acc + (answeredMap[id] ? 1 : 0), 0);

  if (answeredCount === total && !clozeHasMore) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', maxWidth: 760, mx: 'auto' }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--color-white)' }}>Results</Typography>
          <Typography variant="body1" sx={{ color: 'color-mix(in srgb, var(--color-white) 74%, transparent)' }}>Score: {correctCount} / {total}</Typography>
          <Button
            variant="contained"
            onClick={() => { setStarted(false); setSessionKey(Date.now()); }}
            sx={{
              borderRadius: 999,
              px: 4,
              bgcolor: 'var(--color-success)',
              color: 'var(--color-navy-deep)',
              fontWeight: 700,
              '&:hover': { bgcolor: 'var(--color-teal-pale)' },
            }}
          >
            Restart practice
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, height: '100%', overflowY: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" sx={{ color: 'color-mix(in srgb, var(--color-white) 70%, transparent)', letterSpacing: 2 }}>
          CLOZES ({clozeTotal || total})
        </Typography>
        <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>
          Progress: {answeredCount} / {total}
        </Typography>
      </Box>

      <Stack spacing={2}>
        {clozes.map(c => (
          <ClozeCard
            key={c.id}
            cloze={c}
            onValidate={handleValidate}
            sessionKey={sessionKey}
            onResult={({ clozeId, correct }) => {
              if (answeredMap[clozeId] == null) {
                // Feed the SR/stats engine (fire-and-forget).
                srService.submitAttempt({ model: 'cloze', item_id: clozeId, method: 'CLOZE', correct }).then(() => {}).catch(() => {});
                setAnsweredMap((prev) => ({ ...prev, [clozeId]: correct }));
              }
            }}
          />
        ))}
      </Stack>

      {clozeHasMore && (
        <Box sx={{ textAlign: 'center', mt: 1 }}>
          <Button
            variant="outlined"
            onClick={loadMore}
            disabled={loadingMore}
            sx={{
              borderRadius: 999,
              borderColor: 'color-mix(in srgb, var(--color-white) 22%, transparent)',
              color: 'var(--color-white)',
              fontWeight: 700,
              textTransform: 'none',
              '&:hover': { borderColor: 'var(--color-teal)', backgroundColor: 'color-mix(in srgb, var(--color-teal) 10%, transparent)' },
              '&.Mui-disabled': { color: 'color-mix(in srgb, var(--color-white) 40%, transparent)', borderColor: 'color-mix(in srgb, var(--color-white) 12%, transparent)' },
            }}
          >
            {loadingMore ? 'Loading…' : `Load more (${Math.max(0, (clozeTotal || clozes.length) - clozes.length)} remaining)`}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default ClozePanel;
