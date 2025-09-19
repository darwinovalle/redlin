import React, { useState, useMemo } from 'react';
import { Box, Typography, Button, Chip } from '@mui/material';
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
    return text_with_blank.replace('_____', '<span style="background:#e9f5f1;padding:2px 6px;border-radius:4px;font-weight:600;letter-spacing:1px;">_____</span>');
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
    <Box sx={{ border: '1px solid #ddd', borderRadius: 2, p: 2, mb: 2, bgcolor: '#fff' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        {difficulty && <Chip size="small" color={difficultyColor} label={difficulty} />}
      </Box>
      <Typography variant="body1" sx={{ mb: 1, color: '#222', lineHeight: 1.45 }} component="div" dangerouslySetInnerHTML={{ __html: renderedText }} />
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
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: 6,
            padding: '10px 12px',
            fontSize: 14,
            lineHeight: 1.4,
            color: '#222',
            outline: 'none',
            boxShadow: 'none'
          }}
          onFocus={(e) => { e.target.style.borderColor = '#888'; }}
          onBlur={(e) => { e.target.style.borderColor = '#ddd'; }}
          placeholder="Type your answer"
          aria-label="Cloze answer"
        />
        <Button type="submit" variant="contained" disabled={submitting || !userAnswer.trim() || result!=null} sx={{ bgcolor: '#6be0a6', '&:hover': { bgcolor: '#56c98f' } }}>
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

export default VideoClozeCard;
