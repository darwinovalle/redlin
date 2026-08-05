import React, { useState, useMemo } from 'react';
import { Box, Typography, Button, Chip, Stack, TextField } from '@mui/material';
import CheckIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/HighlightOff';

/**
 * VideoClozeCard mirrors ClozeCard for videos.
 * Props:
 *  - cloze: { id, text_with_blank, answer, options, difficulty }
 *  - onValidate: async ({ clozeId, answer }) => { correct: bool }
 *  - sessionKey: number (reshuffle trigger)
 *  - onResult: callback({ clozeId, correct })
 */
const VideoClozeCard = ({ cloze, onValidate, sessionKey, onResult }) => {
  const [userAnswer, setUserAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!cloze) return null;
  const { text_with_blank, options, difficulty, answer } = cloze;

  const difficultyColor = difficulty === 'hard' ? 'error' : difficulty === 'medium' ? 'warning' : 'success';

  const displayOptions = useMemo(() => {
    let base = Array.isArray(options) ? [...options] : [];
    if (answer && !base.includes(answer)) base.push(answer);
    for (let i = base.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [base[i], base[j]] = [base[j], base[i]];
    }
    return base;
  }, [options, answer, cloze.id, sessionKey]);

  const renderedText = useMemo(() => {
    if (!text_with_blank) return '';
    return text_with_blank.replace(
      '_____',
      '<span style="background:color-mix(in srgb, var(--color-success) 14%, transparent);padding:2px 6px;border-radius:6px;font-weight:700;letter-spacing:1px;border:1px solid color-mix(in srgb, var(--color-success) 18%, transparent)">_____</span>'
    );
  }, [text_with_blank]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userAnswer.trim() || result != null) return;
    try {
      setSubmitting(true);
      const r = await onValidate({ clozeId: cloze.id, answer: userAnswer });
      setResult(!!r?.correct);
      try { onResult && onResult({ clozeId: cloze.id, correct: !!r?.correct }); } catch (_) {}
    } catch (err) {
      console.error('Validation error', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        border: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)',
        borderRadius: 4,
        p: 2.25,
        mb: 2,
        bgcolor: 'color-mix(in srgb, var(--color-navy-deep) 82%, transparent)',
        boxShadow: '0 18px 48px color-mix(in srgb, var(--color-black) 24%, transparent)',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Typography variant="overline" sx={{ letterSpacing: 2.5, color: 'color-mix(in srgb, var(--color-white) 50%, transparent)' }}>
          CLOZE
        </Typography>
        {difficulty && <Chip size="small" color={difficultyColor} label={difficulty} sx={{ fontWeight: 700, textTransform: 'capitalize' }} />}
      </Box>

      <Typography
        variant="body1"
        sx={{ mb: 1.5, color: 'var(--color-white)', lineHeight: 1.55, fontSize: 16 }}
        component="div"
        dangerouslySetInnerHTML={{ __html: renderedText }}
      />

      {displayOptions.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.75 }}>
          {displayOptions.map((opt, i) => (
            <Chip
              key={i}
              label={opt}
              onClick={() => { if (result == null) setUserAnswer(opt); }}
              variant={userAnswer === opt ? 'filled' : 'outlined'}
              disabled={result != null}
              sx={{
                borderRadius: 999,
                borderColor: 'color-mix(in srgb, var(--color-white) 14%, transparent)',
                color: 'var(--color-white)',
                bgcolor: userAnswer === opt ? 'color-mix(in srgb, var(--color-success) 16%, transparent)' : 'transparent',
                '& .MuiChip-label': { px: 0.5 },
              }}
            />
          ))}
        </Box>
      )}

      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <TextField
          value={userAnswer}
          disabled={submitting || result != null}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="Type your answer"
          aria-label="Cloze answer"
          fullWidth
          sx={{
            flex: '1 1 320px',
            '& .MuiOutlinedInput-root': {
              color: 'var(--color-white)',
              backgroundColor: 'color-mix(in srgb, var(--color-white) 3%, transparent)',
              borderRadius: 2,
              '& fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 12%, transparent)' },
              '&:hover fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 22%, transparent)' },
              '&.Mui-focused fieldset': { borderColor: 'color-mix(in srgb, var(--color-success) 65%, transparent)' },
            },
            '& .MuiInputBase-input::placeholder': { color: 'color-mix(in srgb, var(--color-white) 44%, transparent)', opacity: 1 },
          }}
        />

        <Button
          type="submit"
          variant="contained"
          disabled={submitting || !userAnswer.trim() || result != null}
          sx={{
            minWidth: 110,
            borderRadius: 2,
            bgcolor: 'var(--color-success)',
            color: 'var(--color-navy-deep)',
            fontWeight: 700,
            '&:hover': { bgcolor: 'var(--color-teal-pale)' },
            '&.Mui-disabled': { bgcolor: 'color-mix(in srgb, var(--color-white) 10%, transparent)', color: 'color-mix(in srgb, var(--color-white) 36%, transparent)' },
          }}
        >
          Check
        </Button>
      </Box>

      {result === true && (
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1.5, color: 'success.main', fontWeight: 600 }}>
          <CheckIcon sx={{ fontSize: 18 }} />
          <span>Correct!</span>
        </Stack>
      )}

      {result === false && (
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1.5, color: 'error.main', fontWeight: 600 }}>
          <CloseIcon sx={{ fontSize: 18 }} />
          <span>Incorrect. Try again.</span>
        </Stack>
      )}
    </Box>
  );
};

export default VideoClozeCard;
