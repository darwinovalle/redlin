import React, { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, Stack } from '@mui/material';
import GearSvg from '../../assets/Gear@1x-0.2s-200px-200px (1).svg';
import { clozeService } from '../../services/api/cloze.jsx';
import ClozeCard from './ClozeCard';

/**
 * ClozePanel lists clozes for a selected document and allows validation.
 * Props:
 *  - documentId
 */
const ClozePanel = ({ documentId }) => {
  const [clozes, setClozes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [started, setStarted] = useState(false);
  const [sessionKey, setSessionKey] = useState(null); // changes each time user starts practice
  const [answeredMap, setAnsweredMap] = useState({}); // { clozeId: true|false }

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
    if (!documentId) { setClozes([]); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await clozeService.listDocumentClozes(documentId);
      setClozes(data || []);
    } catch (e) {
      setError(e?.detail || e?.error || 'Failed to load clozes');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => { load(); }, [load]);
  // Reset start gate when document changes
  useEffect(() => { setStarted(false); }, [documentId]);
  useEffect(() => { setAnsweredMap({}); }, [sessionKey]);

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
      <Box
        sx={{
          p: 4,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          textAlign: 'center',
          width: '100%',
          maxWidth: 640,
          mx: 'auto'
        }}
      >
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: 'var(--color-white)' }}>
          Cloze Practice
        </Typography>
        <Typography variant="body1" sx={{ mb: 3, maxWidth: 520, color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>
          Ready? This set contains {clozes.length} cloze {clozes.length === 1 ? 'item' : 'items'}. Fill in the blanks accurately. Click start when you're ready.
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={() => { setClozes((prev) => shuffle(prev)); setSessionKey(Date.now()); setStarted(true); }}
          sx={{
            backgroundColor: 'var(--color-success)',
            borderRadius: '999px',
            px: 4,
            color: 'var(--color-navy-deep)',
            fontWeight: 800,
            '&:hover': { backgroundColor: 'var(--color-teal-pale)' },
          }}
        >
          Start Cloze Practice
        </Button>
      </Box>
    );
  }

  const total = clozes.length;
  const answeredIds = Object.keys(answeredMap);
  const answeredCount = answeredIds.length;
  const correctCount = answeredIds.reduce((acc, id) => acc + (answeredMap[id] ? 1 : 0), 0);

  if (answeredCount === total) {
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
              fontWeight: 800,
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
          CLOZES ({total})
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
            onResult={({ clozeId, correct }) => setAnsweredMap((prev) => prev[clozeId] == null ? { ...prev, [clozeId]: correct } : prev)}
          />
        ))}
      </Stack>
    </Box>
  );
};

export default ClozePanel;
