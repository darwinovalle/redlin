import React, { useCallback, useEffect, useState } from 'react';
import { Box, Typography, Button, Stack } from '@mui/material';
import GearSvg from '../../assets/Gear@1x-0.2s-200px-200px (1).svg';
import { clozeService } from '../../services/api/cloze.jsx';
import { srService } from '../../services/api/sr';
import { useStudySection } from '../../hooks/useStudySession';
import VideoClozeCard from './VideoClozeCard';
import FocusToggle from '../common/FocusToggle';
import dinoStudy from '../../assets/redlin_logo/dino_study.png';

/**
 * VideoClozePanel handles listing & practice flow for video clozes.
 * Props: videoId, focus, onFocusChange, onStart, autoStart, title
 */
const VideoClozePanel = ({ videoId, title = 'Cloze Practice', focus = false, showStudyImage = false, onFocusChange, onStart, autoStart = false }) => {
  // Section timer: attribute Cloze practice time to this video source.
  useStudySection({ model: 'video', itemId: videoId, method: 'CLOZE' });
  const [clozes, setClozes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [started, setStarted] = useState(false);
  const [sessionKey, setSessionKey] = useState(null);
  const [answeredMap, setAnsweredMap] = useState({});

  const shuffle = useCallback((arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, []);

  const load = useCallback(async () => {
    if (!videoId) { setClozes([]); return; }
    setLoading(true); setError(null);
    try {
      const data = await clozeService.listVideoClozes(videoId);
      setClozes(data || []);
    } catch (e) {
      setError(e?.detail || e?.error || 'Failed to load clozes');
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setStarted(false); }, [videoId]);

  // Focus Mode: when rendered inside the focus dialog, begin immediately.
  useEffect(() => {
    if (autoStart && clozes.length && !started) {
      setClozes((prev) => shuffle(prev));
      setSessionKey(Date.now());
      setStarted(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, clozes.length, started]);
  useEffect(() => { setAnsweredMap({}); }, [sessionKey]);

  const handleValidate = async ({ clozeId, answer }) => {
    return clozeService.validate({ clozeId, answer, type: 'video' });
  };

  if (!videoId) {
    return (
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>Select a video to practice clozes.</Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <img src={GearSvg} alt="Loading" width={30} height={30} />
        <Typography sx={{ ml: 2, color: 'var(--color-white)' }}>Loading Clozes...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography sx={{ color: 'var(--color-danger-softer)' }}>Error: {error}</Typography>
      </Box>
    );
  }

  if (!clozes || clozes.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography sx={{ maxWidth: 480, color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>
          This video doesn't have Cloze exercises enabled yet.
        </Typography>
      </Box>
    );
  }

  if (!started) {
    return (
      <Box sx={{ textAlign: 'center', p: 3, maxWidth: 760, mx: 'auto' }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h4" sx={{ mb: 0.5, fontWeight: 700, color: 'var(--color-white)' }}>
            {title}
          </Typography>
          <Typography variant="body1" sx={{ mb: 1.5, color: 'color-mix(in srgb, var(--color-white) 72%, transparent)', maxWidth: 520 }}>
            Ready? This session contains {clozes.length} cloze {clozes.length === 1 ? 'item' : 'items'}. Fill in the blanks.
          </Typography>
          <Button
            variant="contained"
            size="large"
            disabled={!clozes.length}
            onClick={() => { if (focus) onStart?.(); else { setClozes(prev => shuffle(prev)); setSessionKey(Date.now()); setStarted(true); } }}
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
          CLOZES ({total})
        </Typography>
        <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>
          Progress: {answeredCount} / {total}
        </Typography>
      </Box>

      <Stack spacing={2}>
        {clozes.map(c => (
          <VideoClozeCard
            key={c.id}
            cloze={c}
            onValidate={handleValidate}
            sessionKey={sessionKey}
            onResult={({ clozeId, correct }) => {
              if (answeredMap[clozeId] == null) {
                srService.submitAttempt({ model: 'video_cloze', item_id: clozeId, method: 'CLOZE', correct }).then(() => {}).catch(() => {});
                setAnsweredMap(prev => prev[clozeId] == null ? { ...prev, [clozeId]: correct } : prev);
              }
            }}
          />
        ))}
      </Stack>
    </Box>
  );
};

export default VideoClozePanel;
