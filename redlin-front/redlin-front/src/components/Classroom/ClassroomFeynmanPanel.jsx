import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Chip, Divider, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import PropTypes from 'prop-types';
import GearSvg from '../../assets/Gear@1x-0.2s-200px-200px (1).svg';
import { classroomService } from '../../services/api/classroom';

const COUNTDOWN = 210; // 3:30

const getSpeechRecognition = () => {
  if (typeof window === 'undefined') return null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  return SR ? new SR() : null;
};

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const Metric = ({ label, value, color }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 1, minWidth: 84 }}>
    <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 52%, transparent)' }}>{label}</Typography>
    <Typography variant="subtitle1" sx={{ fontWeight: 800, color }}>{value ?? '—'}</Typography>
  </Box>
);

const ClassroomFeynmanPanel = ({ sessionId, prompts: initialPrompts, language = 'en' }) => {
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
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef(null);
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

  const accumulatedRef = useRef('');
  const interimRef = useRef('');
  const stopRequestedRef = useRef(false);

  const toggleRecording = () => {
    if (recording) {
      stopRecording();
      return;
    }
    const current = prompts[currentIndex];
    if (!current || questionDone) return;
    const recognition = getSpeechRecognition();
    if (!recognition) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }
    recognitionRef.current = recognition;
    stopRequestedRef.current = false;
    // seed from the current draft and keep every new segment appended, so a
    // pause or silence can never clear the words already captured.
    interimRef.current = '';
    accumulatedRef.current = ` ${answers[current.id] || ''}`;
    recognition.lang = language === 'es' ? 'es-ES' : 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      // Accumulate finalized words into a permanent buffer (never reset),
      // and show the still-being-spoken interim segment as a live tail.
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const seg = event.results[i][0].transcript.trim();
        if (event.results[i].isFinal) {
          if (seg) accumulatedRef.current = `${accumulatedRef.current} ${seg}`.replace(/\s+/g, ' ').trim();
          interimRef.current = '';
        } else if (seg) {
          interimRef.current = seg;
        }
      }
      const id = prompts[currentIndex]?.id;
      if (id == null) return;
      const shown = interimRef.current
        ? `${accumulatedRef.current} ${interimRef.current}`.trim()
        : accumulatedRef.current;
      setAnswers((previous) => ({ ...previous, [id]: shown }));
    };
    recognition.onend = () => {
      // A natural silence or browser end drops out of recording mode but
      // NEVER clears the accumulated text; pressing the mic again continues.
      setRecording(false);
    };
    recognition.start();
    setRecording(true);
  };

  const stopRecording = () => {
    stopRequestedRef.current = true;
    try { recognitionRef.current?.stop(); } catch {}
    setRecording(false);
    interimRef.current = '';
  };

  // stop any in-flight recognition and reset accumulation when the question changes
  useEffect(() => () => {
    stopRequestedRef.current = true;
    try { recognitionRef.current?.stop(); } catch {}
    accumulatedRef.current = '';
    interimRef.current = '';
  }, [currentIndex]);

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
        <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>Select a classroom session to start Feynman practice.</Typography>
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
        <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>No Feynman prompts yet. Generate the classroom materials first.</Typography>
      </Box>
    );
  }

  if (!sessionActive && !sessionFinished) {
    return (
      <Box sx={{ textAlign: 'center', p: 3, maxWidth: 760, mx: 'auto' }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h4" sx={{ mb: 0.5, fontWeight: 700, color: 'var(--color-white)' }}>
            Feynman Session
          </Typography>
          <Typography variant="body1" sx={{ mb: 1.5, color: 'color-mix(in srgb, var(--color-white) 72%, transparent)', maxWidth: 520 }}>
            {prompts.length
              ? `You will have 3 minutes and 30 seconds per question to write or dictate your explanation. When time ends, your answer is auto-submitted.`
              : 'No Feynman prompts generated yet.'}
          </Typography>
          <Button
            variant="contained"
            size="large"
            disabled={!prompts.length}
            onClick={startSession}
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
        </Stack>
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
          border: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)',
          borderRadius: 3,
          bgcolor: 'color-mix(in srgb, var(--color-white) 3%, transparent)',
          color: 'var(--color-white)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'var(--color-white)' }}>AI Evaluation</Typography>
          {attempt.score != null && (
            <Chip
              label={`Score: ${attempt.score}`}
              sx={{
                bgcolor: attempt.score >= 80 ? 'color-mix(in srgb, var(--color-success) 20%, transparent)' : attempt.score >= 60 ? 'color-mix(in srgb, var(--color-amber) 18%, transparent)' : 'color-mix(in srgb, var(--color-danger-softer) 18%, transparent)',
                color: 'var(--color-white)',
                fontWeight: 700,
              }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
          <Metric label="Coverage" value={formatPct(breakdown.coverage)} color="var(--color-white)" />
          <Metric label="Accuracy" value={formatPct(breakdown.accuracy)} color="var(--color-white)" />
          <Metric label="Clarity" value={formatPct(breakdown.clarity)} color="var(--color-white)" />
          <Metric label="Simplicity" value={formatPct(breakdown.simplicity)} color="var(--color-white)" />
          <Metric label="Misconceptions" value={formatPct(breakdown.misconceptions_penalty, true)} color="var(--color-danger-faint)" />
          <Metric label="Hallucination" value={formatPct(breakdown.hallucination_penalty, true)} color="var(--color-danger-faint)" />
          {attempt.key_points_coverage != null && <Metric label="KP Coverage" value={formatPct(attempt.key_points_coverage)} color="var(--color-white)" />}
        </Box>

        {breakdown.feedback && (
          <Typography variant="body2" sx={{ mt: 2, whiteSpace: 'pre-wrap', color: 'color-mix(in srgb, var(--color-white) 84%, transparent)' }}>
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
      <Box sx={{ p: 2, height: '100%', position: 'relative', overflowY: 'auto', color: 'var(--color-white)' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 2, color: 'var(--color-white)' }}>Session Summary</Typography>
        <Typography variant="body2" sx={{ mb: 3, color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>
          You completed {results.length} / {prompts.length} questions.
        </Typography>
        <Divider sx={{ mb: 2, borderColor: 'color-mix(in srgb, var(--color-white) 8%, transparent)' }} />
        {results.map((attempt) => {
          const promptItem = prompts.find((prompt) => prompt.id === attempt.feynman) || {};

          return (
            <Box
              key={attempt.id}
              sx={{
                mb: 2,
                p: 2,
                border: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)',
                borderRadius: 3,
                bgcolor: 'color-mix(in srgb, var(--color-white) 3%, transparent)',
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>
                Question
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1.5, color: 'var(--color-white)' }}>
                {promptItem.prompt || ''}
              </Typography>
              {attempt.score != null && (
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'var(--color-white)' }}>
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
    );
  }

  return (
    <Box sx={{ p: 2, height: '100%', position: 'relative', overflowY: 'auto', color: 'var(--color-white)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: 'var(--color-white)' }}>
          Question {currentIndex + 1} / {prompts.length}
        </Typography>
        <Box sx={{ color: 'color-mix(in srgb, var(--color-white) 78%, transparent)', fontFamily: 'monospace', fontSize: 14 }}>
          Time Left: {formatTime(countdownRemaining)}
        </Box>
      </Box>

      <Box
        sx={{
          p: 2,
          border: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)',
          borderRadius: 3,
          mb: 2,
          background: 'color-mix(in srgb, var(--color-white) 3%, transparent)',
          color: 'var(--color-white)',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>
          Question
        </Typography>
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.45, color: 'var(--color-white)' }}>
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
          InputLabelProps={{ sx: { color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' } }}
          InputProps={{
            sx: {
              color: 'var(--color-white)',
              bgcolor: 'color-mix(in srgb, var(--color-white) 3%, transparent)',
              borderRadius: 2,
              '& fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 12%, transparent)' },
              '&:hover fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 22%, transparent)' },
              '&.Mui-focused fieldset': { borderColor: 'color-mix(in srgb, var(--color-success) 65%, transparent)' },
            },
          }}
        />
        <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1} sx={{ mt: 2 }}>
          <IconButton
            aria-label={recording ? 'Stop recording' : 'Record answer by voice'}
            onClick={toggleRecording}
            disabled={submitting || questionDone}
            sx={{
              color: recording ? 'var(--color-danger-soft)' : 'var(--color-white)',
              backgroundColor: recording ? 'color-mix(in srgb, var(--color-danger-softer) 16%, transparent)' : 'color-mix(in srgb, var(--color-white) 6%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-white) 14%, transparent)',
              '&:hover': { backgroundColor: recording ? 'color-mix(in srgb, var(--color-danger-softer) 24%, transparent)' : 'color-mix(in srgb, var(--color-white) 12%, transparent)' },
              '&.Mui-disabled': { color: 'color-mix(in srgb, var(--color-white) 30%, transparent)', backgroundColor: 'transparent' },
            }}
          >
            {recording ? <StopIcon /> : <MicIcon />}
          </IconButton>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || questionDone || !(answers[current.id] || '').trim()}
            sx={{
              backgroundColor: 'var(--color-success)',
              color: 'var(--color-navy-deep)',
              borderRadius: '999px',
              px: 4,
              fontWeight: 800,
              '&:hover': { backgroundColor: 'var(--color-teal-pale)' },
              '&.Mui-disabled': { bgcolor: 'color-mix(in srgb, var(--color-white) 10%, transparent)', color: 'color-mix(in srgb, var(--color-white) 36%, transparent)' },
            }}
          >
            Submit Explanation
          </Button>
        </Stack>
      </Box>

      {!questionDone && recording && (
        <Typography
          variant="caption"
          sx={{
            mt: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: 'var(--color-danger-soft)',
            fontWeight: 600,
            fontStyle: 'italic',
            '&::before': {
              content: '""',
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: 'var(--color-danger-soft)',
              boxShadow: '0 0 0 0 color-mix(in srgb, var(--color-danger-soft) 60%, transparent)',
              animation: 'classroomRecPulse 1.6s infinite',
            },
            '@keyframes classroomRecPulse': {
              '0%': { boxShadow: '0 0 0 0 color-mix(in srgb, var(--color-danger-soft) 60%, transparent)' },
              '70%': { boxShadow: '0 0 0 8px transparent' },
              '100%': { boxShadow: '0 0 0 0 transparent' },
            },
          }}
        >
          Listening live…
        </Typography>
      )}

      {!questionDone && (
        <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>
          Time ends → auto-submit. Use the mic to dictate your answer.
        </Typography>
      )}

      {questionDone && (
        <Box sx={{ mt: 2 }}>
          {renderFeedbackCard(currentAttempt)}
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