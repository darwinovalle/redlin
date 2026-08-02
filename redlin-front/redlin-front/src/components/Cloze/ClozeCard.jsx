import React, { useState, useMemo } from 'react';
import { Box, Typography, Button, Chip } from '@mui/material';
import CheckIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/HighlightOff';

/**
 * ClozeCard
 * Props:
 *  - cloze: { id, text_with_blank, answer, options, difficulty }
 *  - onValidate: async ({ clozeId, answer }) => { correct: bool }
 *  - sessionKey: number (changes each practice start to reshuffle options)
 *  - onResult: function({ clozeId, correct }) optional callback when user validates
 */
const ClozeCard = ({ cloze, onValidate, sessionKey, onResult }) => {
  const [userAnswer, setUserAnswer] = useState('');
  const [result, setResult] = useState(null); // null | true | false
  const [submitting, setSubmitting] = useState(false);

  if (!cloze) return null;
  const { text_with_blank, options, difficulty, answer } = cloze;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userAnswer.trim() || result != null) return; // prevent changes after answered
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

  // No reset per requirement (lock after check)

  const difficultyColor = difficulty === 'hard' ? 'error' : difficulty === 'medium' ? 'warning' : 'success';

  // Merge answer into options and shuffle per session key
  const displayOptions = useMemo(() => {
    let base = Array.isArray(options) ? [...options] : [];
    if (answer && !base.includes(answer)) base.push(answer);
    // Shuffle using Fisher-Yates seeded by sessionKey + cloze.id randomness via Math.random snapshot
    // We just run standard shuffle; dependency array includes sessionKey so reshuffles each start
    for (let i = base.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [base[i], base[j]] = [base[j], base[i]];
    }
    return base;
  }, [options, answer, cloze.id, sessionKey]);

  // Ensure readable text color; sanitize / simple blank highlight
  const renderedText = useMemo(() => {
    if (!text_with_blank) return '';
    // Light highlight for the blank underscores only (first occurrence)
    return text_with_blank.replace('_____', '<span style="background:var(--color-surface-teal-tint);padding:2px 6px;border-radius:4px;font-weight:600;letter-spacing:1px;">_____</span>');
  }, [text_with_blank]);

  return (
    <Box sx={{ border: '1px solid var(--color-divider)', borderRadius: 2, p: 2, mb: 2, bgcolor: 'var(--color-white)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        {difficulty && <Chip size="small" color={difficultyColor} label={difficulty} />}
      </Box>
      <Typography variant="body1" sx={{ mb: 1, color: 'var(--color-text-strong)', lineHeight: 1.45 }} component="div" dangerouslySetInnerHTML={{ __html: renderedText }} />
  {displayOptions.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
          {displayOptions.map((opt, i) => (
    <Chip key={i} label={opt} onClick={() => { if (result==null) setUserAnswer(opt); }} variant={userAnswer===opt? 'filled':'outlined'} disabled={result!=null} />
          ))}
        </Box>
      )}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={userAnswer}
      disabled={submitting || result!=null}
          onChange={(e) => setUserAnswer(e.target.value)}
          style={{
            flex: 1,
            background: 'var(--color-white)',
            border: '1px solid var(--color-divider)',
            borderRadius: 6,
            padding: '10px 12px',
            fontSize: 14,
            lineHeight: 1.4,
            color: 'var(--color-text-strong)',
            outline: 'none',
            boxShadow: 'none'
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--color-text-dim)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--color-divider)'; }}
          placeholder="Type your answer"
          aria-label="Cloze answer"
        />
  <Button type="submit" variant="contained" disabled={submitting || !userAnswer.trim() || result!=null} sx={{ bgcolor: 'var(--color-success)', '&:hover': { bgcolor: 'var(--color-success-deep)' } }}>
          Check
        </Button>
      </form>
      {result === true && (
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, color: 'success.main', fontSize: 14 }}>
          <CheckIcon sx={{ fontSize: 18, mr: 0.5 }} /> Correct!
        </Box>
      )}
      {result === false && (
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, color: 'error.main', fontSize: 14 }}>
          <CloseIcon sx={{ fontSize: 18, mr: 0.5 }} /> Incorrect. Try again.
        </Box>
      )}
    </Box>
  );
};

export default ClozeCard;
