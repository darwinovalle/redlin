import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Typography, Button, Divider } from '@mui/material';
import { feynmanService } from '../../services/api/feynman.jsx';
import FeynmanAttemptForm from '../Feynman/FeynmanAttemptForm';
import AIFeedback from '../Feynman/AIFeedback';
import Timer from '../Feynman/Timer';
import GearSvg from '../../assets/Gear@1x-0.2s-200px-200px (1).svg';

const VideoFeynmanPanel = ({ videoId }) => {
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
  const [sessionKey, setSessionKey] = useState(Date.now());
  const COUNTDOWN = 210; // 3:30 per question
  const autoSubmittingRef = useRef(false);
  const justAdvancedRef = useRef(false); // guard against immediate onExpire after Next
  const evalIndexRef = useRef(null); // ensure applying result to right question

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
      <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 2, color: 'var(--color-white)' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--color-white)' }}>Feynman Session</Typography>
        <Typography variant="body2" sx={{ maxWidth: 640, color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>
          You will have 3 minutes and 30 seconds per question to write or dictate your explanation via the mic. When time ends, your answer (even if incomplete) is auto-submitted. After evaluation, click Next to continue. You'll see a summary at the end.
        </Typography>
        <Button
          variant="contained"
          onClick={startSession}
          sx={{
            backgroundColor: 'var(--color-success)',
            color: 'var(--color-navy-deep)',
            borderRadius: '999px',
            px: 4,
            fontWeight: 800,
            '&:hover': { backgroundColor: 'var(--color-teal-pale)' },
          }}
        >
          Start Session ({prompts.length} questions)
        </Button>
      </Box>
    );
  }

  const current = prompts[currentIndex];

  return (
    <Box sx={{ p: 2, height: '100%', position: 'relative', overflowY: 'auto', color: 'var(--color-white)' }}>
      {sessionFinished ? (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 2, color: 'var(--color-white)' }}>Session Summary</Typography>
          <Typography variant="body2" sx={{ mb: 3, color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>
            You completed {results.length} / {prompts.length} questions.
          </Typography>
          <Divider sx={{ mb: 2, borderColor: 'color-mix(in srgb, var(--color-white) 8%, transparent)' }} />
          {results.map(r => (
            <Box key={r.id} sx={{ mb: 2, p: 2, border: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)', borderRadius: 3, bgcolor: 'color-mix(in srgb, var(--color-white) 3%, transparent)' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>Question</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1, color: 'var(--color-white)' }}>{(prompts.find(p => p.id === r.feynman) || {}).prompt}</Typography>
              {r.score != null && <Typography variant="caption" sx={{ fontWeight: 800, color: 'var(--color-white)' }}>Score: {r.score}</Typography>}
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
              fontWeight: 800,
              '&:hover': { backgroundColor: 'var(--color-teal-pale)' },
            }}
          >
            Restart Session
          </Button>
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: 'var(--color-white)' }}>Question {currentIndex + 1} / {prompts.length}</Typography>
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
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>Question</Typography>
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
                  fontWeight: 800,
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
