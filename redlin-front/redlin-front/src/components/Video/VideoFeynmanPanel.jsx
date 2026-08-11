import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Typography, Button, Divider, Stack } from '@mui/material';
import { feynmanService } from '../../services/api/feynman.jsx';
import { srService } from '../../services/api/sr';
import { useStudySection } from '../../hooks/useStudySession';
import FeynmanAttemptForm from '../Feynman/FeynmanAttemptForm';
import AIFeedback from '../Feynman/AIFeedback';
import Timer from '../Feynman/Timer';
import GearSvg from '../../assets/Gear@1x-0.2s-200px-200px (1).svg';
import FocusToggle from '../common/FocusToggle';
import dinoStudy from '../../assets/redlin_logo/dino_study.png';

const VideoFeynmanPanel = ({ videoId, title = 'Feynman Session', focus = false, showStudyImage = false, onFocusChange, onStart, autoStart = false }) => {
  // Section timer: attribute Feynman practice time to this video source.
  
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Session state
  const [sessionActive, setSessionActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // feynmanId -> text
  const [results, setResults] = useState([]); // attempts data
  const [currentAttempt, setCurrentAttempt] = useState(null); // attempt of current question
  const [countdownRemaining, setCountdownRemaining] = useState(60);
  const [questionDone, setQuestionDone] = useState(false); // submitted & evaluated
  const [sessionFinished, setSessionFinished] = useState(false);
  useStudySection({ model: 'video', itemId: videoId, method: 'FEYNMAN', active: sessionActive && !sessionFinished });
  const [sessionKey, setSessionKey] = useState(Date.now());
  const COUNTDOWN = 210; // 3:30 per question
  const autoSubmittingRef = useRef(false);
  const justAdvancedRef = useRef(false); // guard against immediate onExpire after Next
  const evalIndexRef = useRef(null); // ensure applying result to right question
  const sessionStartedAtRef = useRef(null);
  const sessionSentRef = useRef(false);

  const loadAll = useCallback(async () => {
    if (!videoId) { setPrompts([]); return; }
    setLoading(true);
    try {
      const p = await feynmanService.listVideoPrompts(videoId);
      setPrompts(p || []);
    } catch (e) {
      console.error('Load Video Feynman error', e);
    } finally { setLoading(false); }
  }, [videoId]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { setSessionKey(Date.now()); }, [currentIndex]);

  const submitCurrent = useCallback(async () => {
    if (submitting || autoSubmittingRef.current || questionDone) return;
    const current = prompts[currentIndex];
    if (!current) return;
    const text = answers[current.id] || '';
    autoSubmittingRef.current = true;
    setSubmitting(true);
    evalIndexRef.current = currentIndex;
    try {
      const data = await feynmanService.evaluateVideo({ videoId, feynmanId: current.id, answer: text });
      // apply only if still on same question
      if (evalIndexRef.current === currentIndex) {
        setCurrentAttempt(data);
        setResults(r => [...r, data]);
        setQuestionDone(true);
      }
    } catch (e) { console.error('Video eval error', e); }
    finally {
      setSubmitting(false);
      autoSubmittingRef.current = false;
    }
  }, [answers, currentIndex, videoId, prompts, submitting, questionDone]);

  const handleManualSubmit = async (val) => {
    const current = prompts[currentIndex];
    setAnswers(a => ({ ...a, [current.id]: val }));
    await submitCurrent();
  };

  const handleChangeDraft = (val) => {
    const current = prompts[currentIndex];
    if (!current || questionDone) return;
    setAnswers(a => ({ ...a, [current.id]: val }));
  };

  const startSession = () => {
    sessionStartedAtRef.current = Date.now();
    sessionSentRef.current = false;
    setSessionActive(true);
    setSessionFinished(false);
    setResults([]);
    setAnswers({});
    setCurrentIndex(0);
    setSessionKey(Date.now());
    setCurrentAttempt(null);
    setCountdownRemaining(COUNTDOWN);
    setQuestionDone(false);
  };

  // Reset countdown when moving to new question during active session
  useEffect(() => {
    if (!sessionActive || sessionFinished) return; // keep hook order stable
    if (questionDone) return; // don't reset after submission
    setCountdownRemaining(COUNTDOWN);
  }, [currentIndex, sessionActive, sessionFinished, questionDone]);

  // When a session completes, send time + average score to the SR/stats engine.
  useEffect(() => {
    if (!sessionFinished || !results.length) return;
    if (sessionSentRef.current) return;
    sessionSentRef.current = true;
    const elapsed = Math.round((Date.now() - (sessionStartedAtRef.current || Date.now())) / 1000);
    const avg = results.length ? Math.round(results.reduce((a, r) => a + (r.score || 0), 0) / results.length) : 0;
    srService.saveFeynmanSession({
      model: 'video_feynman',
      seconds: elapsed,
      average: avg,
      scores: results.map((r) => ({ item_id: r.feynman, score: r.score })),
    }).then(() => {}).catch(() => {});
  }, [sessionFinished, results]);

  // Focus Mode: when rendered inside the focus dialog, begin immediately.
  useEffect(() => {
    if (autoStart && prompts.length && !sessionActive && !sessionFinished) startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, prompts.length, sessionActive, sessionFinished]);

  if (!videoId) {
    return (
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>Select a video to start Feynman practice.</Typography>
      </Box>
    );
  }
  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <img src={GearSvg} width={30} height={30} alt="Loading" />
        <Typography sx={{ ml: 2, color: 'var(--color-white)' }}>Loading prompts...</Typography>
      </Box>
    );
  }
  if (!prompts.length) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>No Feynman prompts yet. Generate backend side first.</Typography>
      </Box>
    );
  }
  // Start screen
  if (!sessionActive && !sessionFinished) {
    return (
      <Box sx={{ textAlign: 'center', p: 3, maxWidth: 760, mx: 'auto' }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h4" sx={{ mb: 0.5, fontWeight: 700, color: 'var(--color-white)' }}>
            {title}
          </Typography>
          <Typography variant="body1" sx={{ mb: 1.5, color: 'color-mix(in srgb, var(--color-white) 72%, transparent)', maxWidth: 520 }}>
            {prompts.length
              ? `You will have 3 minutes and 30 seconds per question to answer then dictate your explanation via the mic. When time ends, your answer (even if incomplete) is auto-submitted. After evaluation, click Next to continue and you'll see a summary at the end.`
              : 'No Feynman prompts generated yet.'}
          </Typography>
          <Button
            variant="contained"
            size="large"
            disabled={!prompts.length}
            onClick={() => { if (focus) onStart?.(); else startSession(); }}
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
            Start Session ({prompts.length} questions)
          </Button>
          <FocusToggle focus={focus} onChange={onFocusChange} />
          {showStudyImage && (
            <img src={dinoStudy} alt="Start studying" style={{ width: 'auto', height: 300, maxWidth: '100%', objectFit: 'contain', display: 'block', margin: '20px auto 0' }} />
          )}
        </Stack>
      </Box>
    );
  }

  const current = prompts[currentIndex];
  const elapsedSec = Math.round((Date.now() - (sessionStartedAtRef.current || Date.now())) / 1000);
  const avgScore = results.length ? Math.round(results.reduce((a, r) => a + (r.score || 0), 0) / results.length) : 0;

  return (
    <Box sx={{ p: 2, height: '100%', position: 'relative', overflowY: 'auto', color: 'var(--color-white)' }}>
      {sessionFinished ? (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: 'var(--color-white)' }}>Session Summary</Typography>
          <Typography variant="body2" sx={{ mb: 0.5, color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>
            You completed {results.length} / {prompts.length} questions.
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, color: 'var(--color-teal)', fontWeight: 700 }}>
            Time: {Math.floor(Math.max(0, elapsedSec) / 60)}m {Math.max(0, elapsedSec) % 60}s · Avg score: {avgScore}
          </Typography>
          <Divider sx={{ mb: 2, borderColor: 'color-mix(in srgb, var(--color-white) 8%, transparent)' }} />
          {results.map(r => (
            <Box key={r.id} sx={{ mb: 2, p: 2, border: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)', borderRadius: 3, bgcolor: 'color-mix(in srgb, var(--color-white) 3%, transparent)' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>Question</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1, color: 'var(--color-white)' }}>{(prompts.find(p => p.id === r.feynman) || {}).prompt}</Typography>
              {r.score != null && <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-white)' }}>Score: {r.score}</Typography>}
              <AIFeedback attempt={r} />
            </Box>
          ))}
          <Button
            variant="contained"
            onClick={startSession}
            sx={{
              mt: 2,
              backgroundColor: 'var(--color-success)',
              color: 'var(--color-navy-deep)',
              borderRadius: '999px',
              px: 4,
              fontWeight: 700,
              '&:hover': { backgroundColor: 'var(--color-teal-pale)' },
            }}
          >
            Restart Session
          </Button>
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--color-white)' }}>Question {currentIndex + 1} / {prompts.length}</Typography>
            <Timer
              key={currentIndex}
              active={sessionActive && !questionDone}
              resetKey={sessionKey}
              countdownFrom={COUNTDOWN}
              onTick={(rem) => setCountdownRemaining(rem)}
              onExpire={() => { if (!justAdvancedRef.current) submitCurrent(); }}
            />
          </Box>
          <Box sx={{ p: 2, border: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)', borderRadius: 3, mb: 2, background: 'color-mix(in srgb, var(--color-white) 3%, transparent)', color: 'var(--color-white)' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>Question</Typography>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.45, color: 'var(--color-white)' }}>{current.prompt}</Typography>
          </Box>
          <FeynmanAttemptForm
            value={answers[current.id] || ''}
            onChange={handleChangeDraft}
            onSubmit={handleManualSubmit}
            disabled={submitting || questionDone}
            countdownSeconds={countdownRemaining}
            totalSeconds={COUNTDOWN}
          />
          {!questionDone && (
            <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>
              Time ends → auto-submit.
            </Typography>
          )}
          {questionDone && (
            <Box sx={{ mt: 2 }}>
              <AIFeedback attempt={currentAttempt} />
              <Button
                variant="contained"
                sx={{
                  mt: 2,
                  backgroundColor: 'var(--color-success)',
                  color: 'var(--color-navy-deep)',
                  borderRadius: '999px',
                  fontWeight: 700,
                  '&:hover': { backgroundColor: 'var(--color-teal-pale)' },
                }}
                onClick={() => {
                  // Clean up any pending evaluation state
                  autoSubmittingRef.current = false;
                  evalIndexRef.current = null;
                  setSubmitting(false);
                  if (currentIndex < prompts.length - 1) {
                    setCurrentAttempt(null);
                    setQuestionDone(false);
                    setCountdownRemaining(COUNTDOWN);
                    setSessionKey(Date.now());
                    setCurrentIndex(i => i + 1);
                    justAdvancedRef.current = true;
                    setTimeout(() => { justAdvancedRef.current = false; }, 100);
                  } else {
                    setSessionFinished(true);
                    setSessionActive(false);
                  }
                }}
              >
                Next Question
              </Button>
            </Box>
          )}
        </>
      )}
      {submitting && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'color-mix(in srgb, var(--color-navy-deep) 72%, transparent)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            backdropFilter: 'blur(4px)',
          }}
        >
          <img src={GearSvg} width={60} height={60} alt="Evaluating" />
          <Typography variant="body2" sx={{ mt: 1, color: 'var(--color-white)' }}>Evaluating...</Typography>
        </Box>
      )}
    </Box>
  );
};

export default VideoFeynmanPanel;
