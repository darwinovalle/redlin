import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CircularProgress,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import PropTypes from 'prop-types';

const shuffle = (arr) => {
  const next = [...arr];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
};

const UNANSWERED_SEGMENT_COLOR = 'rgba(255, 255, 255, 0.18)';

const ClassroomQuiz = ({ mcqs }) => {
  const [questions, setQuestions] = useState([]);
  const [active, setActive] = useState(false);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const correctAudioRef = useRef(null);
  const wrongAudioRef = useRef(null);
  const timeoutRef = useRef(null);

  const resetRun = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setActive(false);
    setIdx(0);
    setAnswers({});
    setFeedback(null);
    setFinished(false);
    setScore(0);
  };

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (Array.isArray(mcqs) && mcqs.length) {
      const transformed = mcqs.map((question) => {
        const options = shuffle([
          question.correct_answer,
          question.option_1,
          question.option_2,
          question.option_3,
        ]);

        return {
          id: question.id,
          question: question.question,
          options,
          correct: options.indexOf(question.correct_answer),
        };
      });

      setQuestions(transformed);
    } else {
      setQuestions([]);
    }

    resetRun();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [mcqs]);

  if (!mcqs) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (!active) {
    return (
      <Box sx={{ textAlign: 'center', p: 3, maxWidth: 760, mx: 'auto' }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h4" sx={{ mb: 0.5, fontWeight: 700, color: '#fff' }}>
            Test Your Knowledge
          </Typography>
          <Typography variant="body1" sx={{ mb: 1.5, color: 'rgba(255,255,255,0.72)', maxWidth: 520 }}>
            {questions.length ? `This quiz has ${questions.length} questions.` : 'No MCQs generated yet.'}
          </Typography>
          <Button
            variant="contained"
            size="large"
            disabled={!questions.length}
            onClick={() => setActive(true)}
            sx={{
              borderRadius: '999px',
              backgroundColor: '#6be0a6',
              color: '#07141f',
              px: 4,
              fontWeight: 700,
              boxShadow: '0 18px 40px rgba(107, 224, 166, 0.24)',
              '&:hover': { backgroundColor: '#8bf0bf' },
              '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.36)' },
            }}
          >
            Start Quiz
          </Button>
        </Stack>
      </Box>
    );
  }

  if (!questions.length) {
    return <Alert severity="warning">No MCQs available.</Alert>;
  }

  const current = questions[idx];

  const handleSelect = (value) => {
    if (answers[idx] !== undefined) return;

    const picked = Number.parseInt(value, 10);
    const isCorrect = picked === current.correct;

    setAnswers((previous) => ({ ...previous, [idx]: picked }));
    setFeedback(isCorrect ? 'correct' : 'incorrect');

    if (isCorrect) {
      setScore((previousScore) => previousScore + 1);
      correctAudioRef.current?.play().catch(() => {});
    } else {
      wrongAudioRef.current?.play().catch(() => {});
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setFeedback(null);

      if (idx < questions.length - 1) {
        setIdx((previousIndex) => previousIndex + 1);
      } else {
        setFinished(true);
      }
    }, 1200);
  };

  const colorSegment = (segmentIndex) => {
    if (segmentIndex === idx && !finished) return 'rgba(107, 224, 166, 0.95)';
    if (answers[segmentIndex] === undefined) return UNANSWERED_SEGMENT_COLOR;
    return answers[segmentIndex] === questions[segmentIndex].correct
      ? 'rgba(107, 224, 166, 0.78)'
      : 'rgba(255, 116, 116, 0.82)';
  };

  if (finished) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', maxWidth: 760, mx: 'auto' }}>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 700, color: '#fff' }}>
          Results
        </Typography>
        <Typography variant="body1" sx={{ mb: 3, color: 'rgba(255,255,255,0.72)' }}>
          Score: {score} / {questions.length}
        </Typography>
        <Button
          variant="contained"
          onClick={resetRun}
          sx={{
            borderRadius: '999px',
            px: 4,
            backgroundColor: '#6be0a6',
            color: '#07141f',
            fontWeight: 700,
            boxShadow: '0 18px 40px rgba(107, 224, 166, 0.24)',
            '&:hover': { backgroundColor: '#8bf0bf' },
          }}
        >
          Exit
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 700, mx: 'auto' }}>
      <audio ref={correctAudioRef} preload="auto">
        <source
          src="data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA/////////////////////////////wAAAA8AAAAGAAAGuQCh/////////////////////////////wAAAA8AAAACAAACcQCA/////////////////////////////wAAAA8AAAAGAAAGuQCh/////////////////////////////8AAAANAAAADgAAABH//wAAACQBwAABAgAUABQAAAECAOE4AQABcQQAAcEEAAH//wAAAAgAZGF0Yf//AAD//w=="
          type="audio/mpeg"
        />
      </audio>
      <audio ref={wrongAudioRef} preload="auto">
        <source
          src="data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA/////////////////////////////wAAAA8AAAAGAAAGuQCh/////////////////////////////wAAAA8AAAACAAACcQCA/////////////////////////////wAAAA8AAAAGAAAGuQCh/////////////////////////////8AAAANAAAADgAAABH//wAAACQBwAABAgAUABQAAAECAOE4AQABcQQAAcEEAAH//wAAAAgAZGF0Yf//AAD//w=="
          type="audio/mpeg"
        />
      </audio>

      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.74)', fontWeight: 600 }}>
          {idx + 1} of {questions.length}
        </Typography>
      </Box>

      <Stack direction="row" spacing={0.5} sx={{ width: '80%', mx: 'auto', mb: 4 }}>
        {questions.map((_, segmentIndex) => (
          <Box
            key={segmentIndex}
            sx={{
              flexGrow: 1,
              height: 8,
              borderRadius: 999,
              bgcolor: colorSegment(segmentIndex),
              transition: 'background-color .3s ease, box-shadow .3s ease',
              boxShadow: segmentIndex === idx && !finished ? '0 0 0 3px rgba(107, 224, 166, 0.12)' : 'none',
            }}
          />
        ))}
      </Stack>

      <Typography
        variant="h5"
        textAlign="center"
        sx={{ mb: 3, fontWeight: 600, lineHeight: 1.4, color: '#fff' }}
      >
        {current.question}
      </Typography>

      <Box sx={{ position: 'relative' }}>
        {feedback && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              pointerEvents: 'none',
              '& .fx': {
                fontSize: 90,
                animation: 'pop 0.9s ease forwards',
                color: feedback === 'correct' ? '#6be0a6' : '#ff7474',
                fontWeight: 700,
                textShadow: '0 12px 30px rgba(0,0,0,0.32)',
              },
              '@keyframes pop': {
                '0%': { transform: 'scale(.2)', opacity: 0 },
                '40%': { transform: 'scale(1.05)', opacity: 1 },
                '100%': { transform: 'scale(1)', opacity: 0 },
              },
            }}
          >
            <span className="fx">{feedback === 'correct' ? '👏' : '✖'}</span>
          </Box>
        )}

        <RadioGroup value={answers[idx] !== undefined ? String(answers[idx]) : ''}>
          {current.options.map((option, optionIndex) => (
            <Card
              key={optionIndex}
              sx={{
                mb: 1.5,
                borderRadius: 2,
                border: '1px solid',
                borderColor:
                  answers[idx] === optionIndex
                    ? answers[idx] === current.correct
                      ? 'rgba(107, 224, 166, 0.9)'
                      : 'rgba(255, 116, 116, 0.9)'
                    : 'rgba(255,255,255,0.08)',
                boxShadow: answers[idx] === optionIndex ? 3 : 0,
                opacity: answers[idx] !== undefined && answers[idx] !== optionIndex ? 0.66 : 1,
                backgroundColor:
                  answers[idx] === optionIndex
                    ? answers[idx] === current.correct
                      ? 'rgba(107, 224, 166, 0.1)'
                      : 'rgba(255, 116, 116, 0.08)'
                    : 'rgba(255,255,255,0.03)',
                transition: 'all .3s ease',
              }}
            >
              <CardActionArea
                disabled={answers[idx] !== undefined}
                onClick={() => handleSelect(String(optionIndex))}
                sx={{ borderRadius: 2 }}
              >
                <FormControlLabel
                  value={String(optionIndex)}
                  control={
                    <Radio
                      sx={{
                        ml: 1,
                        color: 'rgba(255,255,255,0.5)',
                        '&.Mui-checked': {
                          color:
                            answers[idx] === optionIndex && answers[idx] === current.correct
                              ? '#6be0a6'
                              : '#ff7474',
                        },
                      }}
                    />
                  }
                  label={option}
                  sx={{
                    width: '100%',
                    m: 0,
                    p: 1.5,
                    '& .MuiFormControlLabel-label': {
                      color: '#fff',
                      fontSize: 15,
                      lineHeight: 1.45,
                    },
                  }}
                />
              </CardActionArea>
            </Card>
          ))}
        </RadioGroup>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Button
            size="small"
            variant="contained"
            onClick={resetRun}
            sx={{
              borderRadius: '999px',
              backgroundColor: '#6be0a6',
              color: '#07141f',
              fontWeight: 700,
              '&:hover': { backgroundColor: '#8bf0bf' },
            }}
          >
            Exit
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

ClassroomQuiz.propTypes = {
  mcqs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      question: PropTypes.string,
      correct_answer: PropTypes.string,
      option_1: PropTypes.string,
      option_2: PropTypes.string,
      option_3: PropTypes.string,
    })
  ),
};

export default ClassroomQuiz;
