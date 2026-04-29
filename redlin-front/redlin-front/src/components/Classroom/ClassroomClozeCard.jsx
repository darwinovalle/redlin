import { useMemo, useState } from 'react';
import { Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/HighlightOff';
import PropTypes from 'prop-types';

const ClassroomClozeCard = ({ cloze, sessionKey, onResult }) => {
  const [userAnswer, setUserAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const safeCloze = cloze || {};
  const { text_with_blank, options, difficulty, answer } = safeCloze;

  const difficultyColor = difficulty === 'hard' ? 'error' : difficulty === 'medium' ? 'warning' : 'success';

  const displayOptions = useMemo(() => {
    const base = Array.isArray(options) ? [...options] : [];
    void sessionKey;
    if (answer && !base.includes(answer)) base.push(answer);

    for (let index = base.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [base[index], base[randomIndex]] = [base[randomIndex], base[index]];
    }

    return base;
  }, [options, answer, sessionKey]);

  const renderedText = useMemo(() => {
    if (!text_with_blank) return '';

    return text_with_blank.replace(
      '_____',
      '<span style="background:rgba(107,224,166,0.14);padding:2px 6px;border-radius:6px;font-weight:700;letter-spacing:1px;border:1px solid rgba(107,224,166,0.18)">_____</span>'
    );
  }, [text_with_blank]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!userAnswer.trim() || result != null) return;

    try {
      setSubmitting(true);
      const normalizedExpected = (answer || '').trim().toLowerCase();
      const normalizedProvided = userAnswer.trim().toLowerCase();
      const correct = normalizedExpected === normalizedProvided;

      setResult(correct);
      onResult?.({ clozeId: safeCloze.id, correct });
    } catch (error) {
      console.error('Validation error', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!cloze) return null;

  return (
    <Box
      sx={{
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 4,
        p: 2.25,
        mb: 2,
        bgcolor: 'rgba(8, 14, 22, 0.82)',
        boxShadow: '0 18px 48px rgba(0,0,0,0.24)',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Typography variant="overline" sx={{ letterSpacing: 2.5, color: 'rgba(255,255,255,0.5)' }}>
          CLOZE
        </Typography>
        {difficulty && <Chip size="small" color={difficultyColor} label={difficulty} sx={{ fontWeight: 700, textTransform: 'capitalize' }} />}
      </Box>

      <Typography
        variant="body1"
        sx={{ mb: 1.5, color: '#fff', lineHeight: 1.55, fontSize: 16 }}
        component="div"
        dangerouslySetInnerHTML={{ __html: renderedText }}
      />

      {displayOptions.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.75 }}>
          {displayOptions.map((option, index) => (
            <Chip
              key={`${cloze.id}-${index}`}
              label={option}
              onClick={() => {
                if (result == null) setUserAnswer(option);
              }}
              variant={userAnswer === option ? 'filled' : 'outlined'}
              disabled={result != null}
              sx={{
                borderRadius: 999,
                borderColor: 'rgba(255,255,255,0.14)',
                color: '#fff',
                bgcolor: userAnswer === option ? 'rgba(107,224,166,0.16)' : 'transparent',
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
          onChange={(event) => setUserAnswer(event.target.value)}
          placeholder="Type your answer"
          aria-label="Cloze answer"
          fullWidth
          sx={{
            flex: '1 1 320px',
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderRadius: 2,
              '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.22)' },
              '&.Mui-focused fieldset': { borderColor: 'rgba(107,224,166,0.65)' },
            },
            '& .MuiInputBase-input::placeholder': { color: 'rgba(255,255,255,0.44)', opacity: 1 },
          }}
        />

        <Button
          type="submit"
          variant="contained"
          disabled={submitting || !userAnswer.trim() || result != null}
          sx={{
            minWidth: 110,
            borderRadius: 2,
            bgcolor: '#6be0a6',
            color: '#07141f',
            fontWeight: 800,
            '&:hover': { bgcolor: '#8bf0bf' },
            '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.36)' },
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

ClassroomClozeCard.propTypes = {
  cloze: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    text_with_blank: PropTypes.string,
    answer: PropTypes.string,
    options: PropTypes.arrayOf(PropTypes.string),
    difficulty: PropTypes.oneOf(['easy', 'medium', 'hard']),
  }),
  sessionKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onResult: PropTypes.func,
};

export default ClassroomClozeCard;