import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Chip, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import PropTypes from 'prop-types';
import GearSvg from '../../assets/Gear@1x-0.2s-200px-200px (1).svg';
import { classroomService } from '../../services/api/classroom';

const COUNTDOWN = 60;

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const Metric = ({ label, value, color }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 1, minWidth: 84 }}>
    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.52)' }}>{label}</Typography>
    <Typography variant="subtitle1" sx={{ fontWeight: 800, color }}>{value ?? '—'}</Typography>
  </Box>
);

const ClassroomFeynmanPanel = ({ sessionId, prompts: initialPrompts }) => {
  const [prompts, setPrompts] = useState(Array.isArray(initialPrompts) ? initialPrompts : []);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState([]);
  const [currentAttempt, setCurrentAttempt] = useState(null);
  const [countdownRemaining, setCountdownRemaining] = useState(COUNTDOWN);
  const [questionDone, setQuestionDone] = useState(false);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [sessionKey, setSessionKey] = useState(Date.now());
  const autoSubmittingRef = useRef(false);
  const evalIndexRef = useRef(null);

  const loadAll = useCallback(async () => {
    if (!sessionId) {
      setPrompts([]);
      return;
    }

    if (Array.isArray(initialPrompts) && initialPrompts.length) {
      setPrompts(initialPrompts);
      return;
    }

    setLoading(true);
    try {
      const data = await classroomService.getFeynmanPrompts(sessionId);
      setPrompts(data || []);
    } catch (error) {
      console.error('Load classroom feynman error', error);
    } finally {
      setLoading(false);
    }
  }, [initialPrompts, sessionId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    setSessionKey(Date.now());
  }, [currentIndex]);

  useEffect(() => {
    if (!sessionActive || sessionFinished || questionDone) return;
    const intervalId = window.setInterval(() => {
      setCountdownRemaining((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [sessionActive, sessionFinished, questionDone, currentIndex]);

  const submitCurrent = useCallback(async () => {
    if (submitting || autoSubmittingRef.current || questionDone) return;

    const current = prompts[currentIndex];
    if (!current) return;

    const text = answers[current.id] || '';
    autoSubmittingRef.current = true;
    setSubmitting(true);
    evalIndexRef.current = currentIndex;

    try {
      const data = await classroomService.evaluateFeynman({
        sessionId,
        feynmanId: current.id,
        answer: text,
      });

      if (evalIndexRef.current === currentIndex) {
        setCurrentAttempt(data);
        setResults((previousResults) => [...previousResults, data]);
        setQuestionDone(true);
      }
    } catch (error) {
      console.error('Classroom eval error', error);
    } finally {
      setSubmitting(false);
      autoSubmittingRef.current = false;
    }
  }, [answers, currentIndex, prompts, questionDone, sessionId, submitting]);

  useEffect(() => {
    if (!sessionActive || sessionFinished || questionDone) return;
    if (countdownRemaining === 0) {
      submitCurrent();
    }
  }, [countdownRemaining, questionDone, sessionActive, sessionFinished, submitCurrent]);

  useEffect(() => {
    if (!sessionActive || sessionFinished) return;
    if (questionDone) return;
    setCountdownRemaining(COUNTDOWN);
  }, [currentIndex, sessionActive, sessionFinished, questionDone]);

  const handleManualSubmit = async (value) => {
    const current = prompts[currentIndex];
    if (!current) return;
    setAnswers((previousAnswers) => ({ ...previousAnswers, [current.id]: value }));
    await submitCurrent();
  };

  const handleChangeDraft = (value) => {
    const current = prompts[currentIndex];
    if (!current || questionDone) return;
    setAnswers((previousAnswers) => ({ ...previousAnswers, [current.id]: value }));
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

  if (!sessionId) {
    return (
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.72)' }}>Select a classroom session to start Feynman practice.</Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <img src={GearSvg} width={30} height={30} alt="Loading" />
        <Typography sx={{ ml: 2, color: '#fff' }}>Loading prompts...</Typography>
      </Box>
    );
  }

  if (!prompts.length) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.72)' }}>No Feynman prompts yet. Generate the classroom materials first.</Typography>
      </Box>
    );
  }

  if (!sessionActive && !sessionFinished) {
    return (
      <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 2, color: '#fff' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#fff' }}>Feynman Session</Typography>
        <Typography variant="body2" sx={{ maxWidth: 640, color: 'rgba(255,255,255,0.72)' }}>
          You will have 60 seconds per question to write your explanation. When time ends, your answer is auto-submitted.
          After evaluation, click Next to continue. You&apos;ll see a summary at the end.
        </Typography>
        <Button
          variant="contained"
          onClick={startSession}
          sx={{
            backgroundColor: '#6be0a6',
            color: '#07141f',
            borderRadius: '999px',
            px: 4,
            fontWeight: 800,
            '&:hover': { backgroundColor: '#8bf0bf' },
          }}
        >
          Start Session ({prompts.length} questions)
        </Button>
      </Box>
    );
  }

  const current = prompts[currentIndex];

  const renderFeedbackCard = (attempt) => {
    if (!attempt) return null;
    const breakdown = attempt.breakdown || {};

    return (
      <Paper
        elevation={0}
        sx={{
          mt: 3,
          p: 2,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.03)',
          color: '#fff',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff' }}>AI Evaluation</Typography>
          {attempt.score != null && (
            <Chip
              label={`Score: ${attempt.score}`}
              sx={{
                bgcolor: attempt.score >= 80 ? 'rgba(107,224,166,0.2)' : attempt.score >= 60 ? 'rgba(255,193,7,0.18)' : 'rgba(255,116,116,0.18)',
                color: '#fff',
                fontWeight: 700,
              }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
          <Metric label="Coverage" value={formatPct(breakdown.coverage)} color="#fff" />
          <Metric label="Accuracy" value={formatPct(breakdown.accuracy)} color="#fff" />
          <Metric label="Clarity" value={formatPct(breakdown.clarity)} color="#fff" />
          <Metric label="Simplicity" value={formatPct(breakdown.simplicity)} color="#fff" />
          <Metric label="Misconceptions" value={formatPct(breakdown.misconceptions_penalty, true)} color="#ffb4b4" />
          <Metric label="Hallucination" value={formatPct(breakdown.hallucination_penalty, true)} color="#ffb4b4" />
          {attempt.key_points_coverage != null && <Metric label="KP Coverage" value={formatPct(attempt.key_points_coverage)} color="#fff" />}
        </Box>

        {breakdown.feedback && (
          <Typography variant="body2" sx={{ mt: 2, whiteSpace: 'pre-wrap', color: 'rgba(255,255,255,0.84)' }}>
            {breakdown.feedback}
          </Typography>
        )}
        {breakdown.parse_error && (
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            Parse error: raw response stored.
          </Typography>
        )}
      </Paper>
    );
  };

  if (sessionFinished) {
    return (
      <Box sx={{ p: 2, height: '100%', position: 'relative', overflowY: 'auto', color: '#fff' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 2, color: '#fff' }}>Session Summary</Typography>
        <Typography variant="body2" sx={{ mb: 3, color: 'rgba(255,255,255,0.72)' }}>
          You completed {results.length} / {prompts.length} questions.
        </Typography>
        <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.08)' }} />
        {results.map((attempt) => {
          const promptItem = prompts.find((prompt) => prompt.id === attempt.feynman) || {};

          return (
            <Box
              key={attempt.id}
              sx={{
                mb: 2,
                p: 2,
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.03)',
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: 'rgba(255,255,255,0.72)' }}>
                Question
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1.5, color: '#fff' }}>
                {promptItem.prompt || ''}
              </Typography>
              {attempt.score != null && (
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#fff' }}>
                  Score: {attempt.score}
                </Typography>
              )}
              {renderFeedbackCard(attempt)}
            </Box>
          );
        })}

        <Button
          variant="contained"
          onClick={startSession}
          sx={{
            mt: 2,
            backgroundColor: '#6be0a6',
            color: '#07141f',
            borderRadius: '999px',
            px: 4,
            fontWeight: 800,
            '&:hover': { backgroundColor: '#8bf0bf' },
          }}
        >
          Restart Session
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, height: '100%', position: 'relative', overflowY: 'auto', color: '#fff' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff' }}>
          Question {currentIndex + 1} / {prompts.length}
        </Typography>
        <Box sx={{ color: 'rgba(255,255,255,0.78)', fontFamily: 'monospace', fontSize: 14 }}>
          Time Left: {formatTime(countdownRemaining)}
        </Box>
      </Box>

      <Box
        sx={{
          p: 2,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 3,
          mb: 2,
          background: 'rgba(255,255,255,0.03)',
          color: '#fff',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: 'rgba(255,255,255,0.72)' }}>
          Question
        </Typography>
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.45, color: '#fff' }}>
          {current.prompt}
        </Typography>
      </Box>

      <Box component="form" onSubmit={(event) => { event.preventDefault(); handleManualSubmit(answers[current.id] || ''); }}>
        <TextField
          key={sessionKey}
          label={`Explain in your own words (${formatTime(countdownRemaining)} left)`}
          multiline
          minRows={6}
          value={answers[current.id] || ''}
          onChange={(event) => handleChangeDraft(event.target.value)}
          disabled={submitting || questionDone}
          fullWidth
          InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.6)' } }}
          InputProps={{
            sx: {
              color: '#fff',
              bgcolor: 'rgba(255,255,255,0.03)',
              borderRadius: 2,
              '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.22)' },
              '&.Mui-focused fieldset': { borderColor: 'rgba(107,224,166,0.65)' },
            },
          }}
        />
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || questionDone || !(answers[current.id] || '').trim()}
            sx={{
              backgroundColor: '#6be0a6',
              color: '#07141f',
              borderRadius: '999px',
              px: 4,
              fontWeight: 800,
              '&:hover': { backgroundColor: '#8bf0bf' },
              '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.36)' },
            }}
          >
            Submit Explanation
          </Button>
        </Stack>
      </Box>

      {!questionDone && (
        <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'rgba(255,255,255,0.72)' }}>
          Time ends → auto-submit.
        </Typography>
      )}

      {questionDone && (
        <Box sx={{ mt: 2 }}>
          {renderFeedbackCard(currentAttempt)}
          <Button
            variant="contained"
            sx={{
              mt: 2,
              backgroundColor: '#6be0a6',
              color: '#07141f',
              borderRadius: '999px',
              fontWeight: 800,
              '&:hover': { backgroundColor: '#8bf0bf' },
            }}
            onClick={() => {
              autoSubmittingRef.current = false;
              evalIndexRef.current = null;
              setSubmitting(false);

              if (currentIndex < prompts.length - 1) {
                setCurrentAttempt(null);
                setQuestionDone(false);
                setCountdownRemaining(COUNTDOWN);
                setSessionKey(Date.now());
                setCurrentIndex((index) => index + 1);
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

      {submitting && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(8,14,22,0.72)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            backdropFilter: 'blur(4px)',
          }}
        >
          <img src={GearSvg} width={60} height={60} alt="Evaluating" />
          <Typography variant="body2" sx={{ mt: 1, color: '#fff' }}>Evaluating...</Typography>
        </Box>
      )}
    </Box>
  );
};

const formatPct = (value, isPenalty = false) => {
  if (value == null) return '—';
  const pct = Math.round(value * 100);
  return `${isPenalty ? '-' : ''}${pct}%`;
};

ClassroomFeynmanPanel.propTypes = {
  sessionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  prompts: PropTypes.array,
};

Metric.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  color: PropTypes.string,
};

export default ClassroomFeynmanPanel;