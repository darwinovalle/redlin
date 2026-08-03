import { useEffect, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import PropTypes from 'prop-types';
import ClassroomClozeCard from './ClassroomClozeCard';

const shuffle = (arr) => {
  const next = [...arr];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
};

const ClassroomClozePanel = ({ clozes }) => {
  const [practiceClozes, setPracticeClozes] = useState([]);
  const [started, setStarted] = useState(false);
  const [sessionKey, setSessionKey] = useState(Date.now());
  const [answeredMap, setAnsweredMap] = useState({});

  useEffect(() => {
    setPracticeClozes(Array.isArray(clozes) ? clozes : []);
    setStarted(false);
    setAnsweredMap({});
    setSessionKey(Date.now());
  }, [clozes]);

  const total = practiceClozes.length;
  const answeredIds = Object.keys(answeredMap);
  const answeredCount = answeredIds.length;
  const correctCount = answeredIds.reduce((accumulator, clozeId) => accumulator + (answeredMap[clozeId] ? 1 : 0), 0);

  const handleStart = () => {
    setPracticeClozes((previous) => shuffle(previous));
    setSessionKey(Date.now());
    setAnsweredMap({});
    setStarted(true);
  };

  const handleRestart = () => {
    setPracticeClozes(Array.isArray(clozes) ? [...clozes] : []);
    setAnsweredMap({});
    setSessionKey(Date.now());
    setStarted(false);
  };

  const handleResult = ({ clozeId, correct }) => {
    setAnsweredMap((previous) => (previous[clozeId] == null ? { ...previous, [clozeId]: correct } : previous));
  };

  if (!practiceClozes.length) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>
          This classroom session does not have cloze exercises yet.
        </Typography>
      </Box>
    );
  }

  if (!started) {
    return (
      <Box sx={{ textAlign: 'center', p: 3, maxWidth: 760, mx: 'auto' }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h4" sx={{ mb: 0.5, fontWeight: 700, color: 'var(--color-white)' }}>
            Cloze Practice
          </Typography>
          <Typography variant="body1" sx={{ mb: 1.5, color: 'color-mix(in srgb, var(--color-white) 72%, transparent)', maxWidth: 520 }}>
            {practiceClozes.length
              ? `Ready? This set contains ${practiceClozes.length} cloze ${practiceClozes.length === 1 ? 'item' : 'items'}. Fill in the blanks accurately.`
              : 'No cloze exercises generated yet.'}
          </Typography>
          <Button
            variant="contained"
            size="large"
            disabled={!practiceClozes.length}
            onClick={handleStart}
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
        </Stack>
      </Box>
    );
  }

  if (answeredCount === total) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', maxWidth: 760, mx: 'auto' }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--color-white)' }}>
            Results
          </Typography>
          <Typography variant="body1" sx={{ color: 'color-mix(in srgb, var(--color-white) 74%, transparent)' }}>
            Score: {correctCount} / {total}
          </Typography>
          <Button
            variant="contained"
            onClick={handleRestart}
            sx={{
              borderRadius: 999,
              px: 4,
              bgcolor: 'var(--color-success)',
              color: 'var(--color-navy-deep)',
              fontWeight: 800,
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" sx={{ color: 'color-mix(in srgb, var(--color-white) 70%, transparent)', letterSpacing: 2 }}>
          CLOZES ({total})
        </Typography>
        <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>
          Progress: {answeredCount} / {total}
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2, alignItems: 'start' }}>
        {practiceClozes.map((cloze) => (
          <ClassroomClozeCard
            key={cloze.id}
            cloze={cloze}
            sessionKey={sessionKey}
            onResult={handleResult}
          />
        ))}
      </Box>
    </Box>
  );
};

ClassroomClozePanel.propTypes = {
  clozes: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      text_with_blank: PropTypes.string,
      answer: PropTypes.string,
      options: PropTypes.arrayOf(PropTypes.string),
      difficulty: PropTypes.oneOf(['easy', 'medium', 'hard']),
    })
  ),
};

export default ClassroomClozePanel;