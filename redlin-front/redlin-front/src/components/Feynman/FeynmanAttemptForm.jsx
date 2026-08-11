import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IconButton, Box, Button, Stack, TextField, Typography } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import useWhisperDictation from './useWhisperDictation';
import ListeningIndicator from './ListeningIndicator';

const getSpeechRecognition = () => {
  if (typeof window === 'undefined') return null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  return SR ? new SR() : null;
};

// Controlled form: parent mantiene value y onChange.
// Supports dictation via the mic (interim streaming + accumulated buffer).
const FeynmanAttemptForm = ({ value, onChange, onSubmit, disabled, countdownSeconds, totalSeconds, language = 'en' }) => {
  const [recording, setRecording] = useState(false);
  const [micError, setMicError] = useState('');
  const recognitionRef = useRef(null);
  const accumulatedRef = useRef('');
  const interimRef = useRef('');
  const stopRequestedRef = useRef(false);

  // Firefox fallback: when the Web Speech API is unavailable, record the mic
  // and transcribe the whole utterance with whisper-base.
  const whisper = useWhisperDictation({
    language,
    onTranscript: useCallback((text) => {
      const next = ((value || '') + ' ' + text).replace(/\s+/g, ' ').trim();
      onChange(next);
    }, [value, onChange]),
  });

  const micActive = recording || whisper.listening || whisper.processing;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSubmit(value);
  };

  const handleMic = () => {
    if (micActive) {
      if (recording) stopRecording();
      else if (whisper.listening) whisper.stop();
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      whisper.start();
      return;
    }
    // A fresh instance every time: Firefox fails to start if the previous
    // session is still tearing down when a new start() is issued.
    const recognition = new SR();
    recognitionRef.current = recognition;
    stopRequestedRef.current = false;
    accumulatedRef.current = ` ${value || ''}`;
    interimRef.current = '';
    recognition.lang = 'en-US';  // English-only voice capture
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const seg = event.results[i][0].transcript.trim();
        if (event.results[i].isFinal) {
          if (seg) accumulatedRef.current = `${accumulatedRef.current} ${seg}`.replace(/\s+/g, ' ').trim();
          interimRef.current = '';
        } else if (seg) {
          interimRef.current = seg;
        }
      }
      const shown = interimRef.current
        ? `${accumulatedRef.current} ${interimRef.current}`.trim()
        : accumulatedRef.current;
      onChange(shown);
    };
    recognition.onend = () => {
      // Only the active instance may clear the recording flag, so a stale
      // instance's late onend can't switch the mic off mid-recording.
      if (recognitionRef.current === recognition) setRecording(false);
    };
    recognition.onerror = (event) => {
      if (recognitionRef.current === recognition) {
        setRecording(false);
        if (event?.error && event.error !== 'no-speech') {
          setMicError(`Voice dictation error: ${event.error}. Try again or type your answer.`);
        }
      }
    };
    try {
      recognition.start();
    } catch (err) {
      if (recognitionRef.current === recognition) setRecording(false);
    }
    setRecording(true);
    setMicError('');
  };

  const stopRecording = () => {
    stopRequestedRef.current = true;
    try { recognitionRef.current?.stop(); } catch {}
    interimRef.current = '';
    setRecording(false);
  };

  // clean up recognition on unmount
  useEffect(() => () => {
    stopRequestedRef.current = true;
    try { recognitionRef.current?.stop(); } catch {}
  }, []);

  const timeInfo = (countdownSeconds != null && totalSeconds != null)
    ? `${countdownSeconds}s left`
    : null;

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ position: 'relative' }}>
        <TextField
          label={timeInfo ? `Explain in your own words (${timeInfo})` : 'Explain in your own words (Markdown supported)'}
          multiline
          minRows={6}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
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
        {whisper.listening && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, pointerEvents: 'none' }}>
            <ListeningIndicator label="Listening" />
          </Box>
        )}
        {whisper.processing && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, pointerEvents: 'none' }}>
            <ListeningIndicator label="Processing" />
          </Box>
        )}
      </Box>

      {recording && (
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
              animation: 'feynmanRecPulse 1.6s infinite',
            },
            '@keyframes feynmanRecPulse': {
              '0%': { boxShadow: '0 0 0 0 color-mix(in srgb, var(--color-danger-soft) 60%, transparent)' },
              '70%': { boxShadow: '0 0 0 8px transparent' },
              '100%': { boxShadow: '0 0 0 0 transparent' },
            },
          }}
        >
          Listening live…
        </Typography>
      )}

      <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1}>
        <IconButton
          aria-label={micActive ? 'Stop recording' : 'Record answer by voice'}
          onClick={handleMic}
          disabled={disabled}
          sx={{
            color: micActive ? 'var(--color-danger-soft)' : 'var(--color-white)',
            backgroundColor: micActive ? 'color-mix(in srgb, var(--color-danger-softer) 16%, transparent)' : 'color-mix(in srgb, var(--color-white) 6%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-white) 14%, transparent)',
            '&:hover': { backgroundColor: micActive ? 'color-mix(in srgb, var(--color-danger-softer) 24%, transparent)' : 'color-mix(in srgb, var(--color-white) 12%, transparent)' },
            '&.Mui-disabled': { color: 'color-mix(in srgb, var(--color-white) 30%, transparent)', backgroundColor: 'transparent' },
          }}
        >
          {micActive ? <StopIcon /> : <MicIcon />}
        </IconButton>
        <Button
          type="submit"
          variant="contained"
          disabled={disabled || !value.trim()}
          sx={{
            backgroundColor: 'var(--color-success)',
            color: 'var(--color-navy-deep)',
            borderRadius: '999px',
            px: 4,
            fontWeight: 700,
            '&:hover': { backgroundColor: 'var(--color-teal-pale)' },
            '&.Mui-disabled': { bgcolor: 'color-mix(in srgb, var(--color-white) 10%, transparent)', color: 'color-mix(in srgb, var(--color-white) 36%, transparent)' },
          }}
        >
          Submit Explanation
        </Button>
      </Stack>

      {(micError || whisper.micError) && (
        <Typography variant="caption" sx={{ color: 'var(--color-danger-soft)', textAlign: 'right' }}>
          {micError || whisper.micError}
        </Typography>
      )}
    </Box>
  );
};
export default FeynmanAttemptForm;