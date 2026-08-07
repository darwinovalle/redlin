import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  Card,
  CardActionArea,
  Stack,
  CircularProgress,
  Alert,
} from '@mui/material';
import { documentService } from '../../services/api';
import { srService } from '../../services/api/sr';
import FocusToggle from '../common/FocusToggle';

const shuffleArray = (array) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
};

const UNANSWERED_SEGMENT_COLOR = 'color-mix(in srgb, var(--color-white) 18%, transparent)';

const QuizView = ({ documentId, focus = false, autoStart = false, onStart, onExit, onFocusChange }) => {
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null); // 'correct' | 'incorrect' | null
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);

  // Audio refs
  const correctAudioRef = useRef(null);
  const wrongAudioRef = useRef(null);

  useEffect(() => {
    if (!documentId) {
      setQuizQuestions([]);
      setIsLoading(false);
      setError(null);
      setIsQuizActive(false);
      return;
    }

    const fetchQuizData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const mcqs = await documentService.getQuizForDocument(documentId);

        // Transform MCQ data
        const transformedQuestions = mcqs.map((mcq, index) => {
          // Include all 4 options: correct_answer, option_1, option_2, and option_3
          const options = [mcq.correct_answer, mcq.option_1, mcq.option_2, mcq.option_3];

          // Shuffle all 4 options
          const shuffledOptions = shuffleArray([...options]);
          const correctOptionIndex = shuffledOptions.findIndex(opt => opt === mcq.correct_answer);

          // Basic validation: Check if options seem valid (optional but good practice)
          if (!shuffledOptions.every(opt => typeof opt === 'string' && opt.trim() !== '')) {
              console.warn(`Invalid options detected for question: ${mcq.question}`, mcq);
          }

          return {
            id: mcq.id,
            originalIndex: index,
            question: mcq.question,
            options: shuffledOptions,
            correctOptionIndex: correctOptionIndex,
          };
        });

        setQuizQuestions(transformedQuestions);
        setCurrentQuestionIndex(0);
        setUserAnswers({});
        // Don't reset to the start screen when the focus popup auto-started the
        // quiz — otherwise a refetch (StrictMode double-mount) would cancel it.
        if (!autoStart) setIsQuizActive(false);
        setFeedback(null);
        setFinished(false);
        setScore(0);

      } catch (err) {
        console.error("Failed to fetch quiz data:", err);
        setError(err.message || 'Failed to load quiz questions.');
        setQuizQuestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuizData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, autoStart]);

  const startQuizHandler = () => {
    if (quizQuestions.length > 0) {
        setCurrentQuestionIndex(0);
        setUserAnswers({});
        setIsQuizActive(true);
        setFeedback(null);
        setFinished(false);
        setScore(0);
    }
  };

  // Focus Mode: when rendered inside the focus popup, begin immediately.
  useEffect(() => {
    if (autoStart && quizQuestions.length) startQuizHandler();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, quizQuestions.length]);

  const endQuizHandler = () => {
    setIsQuizActive(false);
    setFinished(false);
    setFeedback(null);
  };

  const handleOptionChange = (selectedOptionIndex) => {
    // avoid double answers
    if (userAnswers[currentQuestionIndex] !== undefined) return;

    const currentCard = quizQuestions[currentQuestionIndex];
    const correct = selectedOptionIndex === currentCard.correctOptionIndex;

    setUserAnswers(prevAnswers => ({
      ...prevAnswers,
      [currentQuestionIndex]: selectedOptionIndex,
    }));

    setFeedback(correct ? 'correct' : 'incorrect');
    if (correct) setScore(s => s + 1);

    // Feed the SR/stats engine: record this MCQ attempt (fire-and-forget).
    srService.submitAttempt({ model: 'mcq', item_id: currentCard.id, method: 'MCQ', correct })
      .then(() => {}).catch(() => {})

    // audio feedback only
    if (correct) {
      correctAudioRef.current && correctAudioRef.current.play().catch(()=>{});
    } else {
      wrongAudioRef.current && wrongAudioRef.current.play().catch(()=>{});
    }

    // advance after brief delay
    setTimeout(() => {
      setFeedback(null);
      if (currentQuestionIndex < quizQuestions.length - 1) {
        setCurrentQuestionIndex(i => i + 1);
      } else {
        setFinished(true); // show results
      }
    }, 1200);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 3 }}>
        <CircularProgress size={28} sx={{ color: 'var(--color-teal)' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const totalQuestions = quizQuestions.length;
  const currentCard = quizQuestions[currentQuestionIndex];

  // Results screen
  if (finished) {
    return (
      <Box sx={{ p:3, textAlign:'center', maxWidth:760, mx:'auto' }}>
        <Typography variant="h5" sx={{ mb:2, fontWeight:700, color:'var(--color-white)' }}>Results</Typography>
        <Typography variant="body1" sx={{ mb:3, color:'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>Score: {score} / {totalQuestions}</Typography>
        <Button
          variant="contained"
          onClick={() => { endQuizHandler(); onExit?.(); }}
          sx={{
            borderRadius:'999px', px:4,
            backgroundColor:'var(--color-success)', color:'var(--color-navy-deep)', fontWeight:700,
            boxShadow:'0 18px 40px color-mix(in srgb, var(--color-success) 24%, transparent)',
            '&:hover': { backgroundColor:'var(--color-teal-pale)' },
          }}
        >
          Exit
        </Button>
      </Box>
    );
  }

  if (!isQuizActive) {
    const canStart = totalQuestions > 0;
    const quizTitle = "Test Your Knowledge";

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          p: 3,
          height: '100%',
          textAlign: 'center'
        }}
      >
        <Typography variant="h4" gutterBottom sx={{ fontWeight:700, color:'var(--color-white)' }}>
          {quizTitle}
        </Typography>
        <Typography variant="body1" sx={{ mb: 3, maxWidth: 520, color:'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>
          {canStart
            ? `Test your knowledge — answer ${totalQuestions} multiple-choice questions about the document.`
            : (documentId ? 'No questions generated for this document yet.' : 'Select a document to generate a quiz.')}
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={() => { if (focus) onStart?.(); else startQuizHandler(); }}
          disabled={!canStart || !documentId}
          sx={{
            borderRadius:'999px', backgroundColor:'var(--color-success)', color:'var(--color-navy-deep)',
            px:4, fontWeight:700,
            boxShadow:'0 18px 40px color-mix(in srgb, var(--color-success) 24%, transparent)',
            '&:hover': { backgroundColor:'var(--color-teal-pale)' },
            '&.Mui-disabled': { bgcolor:'color-mix(in srgb, var(--color-white) 8%, transparent)', color:'color-mix(in srgb, var(--color-white) 36%, transparent)' },
          }}
        >
          {canStart ? 'Start Quiz' : (documentId ? 'No Questions Found' : 'Select Document')}
        </Button>
        <FocusToggle focus={focus} onChange={onFocusChange} />
      </Box>
    );
  }

  if (!currentCard || totalQuestions === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 3 }}>
        <Alert severity="warning">No quiz questions available to display.</Alert>
      </Box>
    );
  }

  const getProgressSegmentColor = (index) => {
    if (index === currentQuestionIndex && !finished) return 'color-mix(in srgb, var(--color-success) 95%, transparent)';
    const answerIndex = userAnswers[index];
    if (answerIndex !== undefined) {
      return answerIndex === quizQuestions[index]?.correctOptionIndex
        ? 'color-mix(in srgb, var(--color-success) 78%, transparent)'
        : 'color-mix(in srgb, var(--color-danger-softer) 82%, transparent)';
    }
    return UNANSWERED_SEGMENT_COLOR;
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        p: 3,
        height: '100%',
        maxWidth: '700px',
        margin: 'auto',
        overflowY: 'auto'
      }}
    >
      {/* Hidden audio elements */}
      <audio ref={correctAudioRef} preload="auto">
        <source src="data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA/////////////////////////////wAAAA8AAAAGAAAGuQCh/////////////////////////////wAAAA8AAAACAAACcQCA/////////////////////////////wAAAA8AAAAGAAAGuQCh/////////////////////////////8AAAANAAAADgAAABH//wAAACQBwAABAgAUABQAAAECAOE4AQABcQQAAcEEAAH//wAAAAgAZGF0Yf//AAD//w==" type="audio/mpeg" />
      </audio>
      <audio ref={wrongAudioRef} preload="auto">
        <source src="data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA/////////////////////////////wAAAA8AAAAGAAAGuQCh/////////////////////////////wAAAA8AAAACAAACcQCA/////////////////////////////wAAAA8AAAAGAAAGuQCh/////////////////////////////8AAAANAAAADgAAABH//wAAACQBwAABAgAUABQAAAECAOE4AQABcQQAAcEEAAH//wAAAAgAZGF0Yf//AAD//w==" type="audio/mpeg" />
      </audio>

      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, width: '100%', justifyContent: 'center' }}>
        <Typography variant="body2" sx={{ color:'color-mix(in srgb, var(--color-white) 74%, transparent)', fontWeight:600 }}>
          {currentQuestionIndex + 1} of {totalQuestions}
        </Typography>
      </Box>

      <Stack direction="row" spacing={0.5} sx={{ width: '80%', mb: 4 }}>
        {Array.from({ length: totalQuestions }).map((_, index) => (
          <Box
            key={`progress-${index}`}
            sx={{
              flexGrow: 1,
              height: '8px',
              borderRadius: '999px',
              bgcolor: getProgressSegmentColor(index),
              transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
              boxShadow: index === currentQuestionIndex && !finished ? '0 0 0 3px color-mix(in srgb, var(--color-success) 12%, transparent)' : 'none',
            }}
          />
        ))}
      </Stack>

      <Typography variant="h5" textAlign="center" sx={{ mb: 3, fontWeight:600, lineHeight:1.4, color:'var(--color-white)' }}>
        {currentCard.question}
      </Typography>

      <Box sx={{ position:'relative', width: '100%' }}>
        {/* Feedback overlay */}
        {feedback && (
          <Box sx={{
            position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
            zIndex:10, pointerEvents:'none',
            '& .fx': {
              fontSize:90, animation:'pop 0.9s ease forwards',
              color: feedback === 'correct' ? 'var(--color-success)' : 'var(--color-danger-softer)',
              fontWeight:700,
              textShadow:'0 12px 30px color-mix(in srgb, var(--color-black) 32%, transparent)',
            },
            '@keyframes pop': { '0%':{ transform:'scale(.2)', opacity:0 }, '40%':{ transform:'scale(1.05)', opacity:1 }, '100%':{ transform:'scale(1)', opacity:0 } }
          }}>
            <span className="fx">{feedback === 'correct' ? '👏' : '✖'}</span>
          </Box>
        )}

        <RadioGroup
          aria-label="quiz-options"
          name="quiz-options-group"
          value={userAnswers[currentQuestionIndex] !== undefined ? userAnswers[currentQuestionIndex].toString() : ''}
          sx={{ width: '100%' }}
        >
          {(currentCard.options && currentCard.options.length > 0) ? currentCard.options.map((option, index) => {
            const answered = userAnswers[currentQuestionIndex] === index;
            const isCorrect = answered && userAnswers[currentQuestionIndex] === currentCard.correctOptionIndex;
            return (
            <Card
              key={index}
              sx={{
                mb: 1.5,
                borderRadius: 2,
                border: '1px solid',
                borderColor: answered
                  ? (isCorrect ? 'color-mix(in srgb, var(--color-success) 90%, transparent)' : 'color-mix(in srgb, var(--color-danger-softer) 90%, transparent)')
                  : 'color-mix(in srgb, var(--color-white) 8%, transparent)',
                boxShadow: answered ? 3 : 0,
                opacity: userAnswers[currentQuestionIndex] !== undefined && !answered ? 0.66 : 1,
                backgroundColor: answered
                  ? (isCorrect ? 'color-mix(in srgb, var(--color-success) 10%, transparent)' : 'color-mix(in srgb, var(--color-danger-softer) 8%, transparent)')
                  : 'color-mix(in srgb, var(--color-white) 3%, transparent)',
                transition: 'all .3s',
              }}
            >
              <CardActionArea
                disabled={userAnswers[currentQuestionIndex] !== undefined}
                onClick={() => handleOptionChange(index)}
                sx={{ borderRadius: 2 }}
              >
                <FormControlLabel
                  value={index.toString()}
                  control={
                    <Radio
                      sx={{
                        ml: 1,
                        color:'color-mix(in srgb, var(--color-white) 50%, transparent)',
                        '&.Mui-checked': { color: isCorrect ? 'var(--color-success)' : 'var(--color-danger-softer)' },
                      }}
                    />
                  }
                  label={option || '(No option text)'}
                  sx={{
                    width: '100%', m: 0, p: 1.5,
                    '& .MuiFormControlLabel-label': { color:'var(--color-white)', fontSize:15, lineHeight:1.45 },
                  }}
                />
              </CardActionArea>
            </Card>
            );
          }) : (
            <Typography textAlign="center" sx={{ color:'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>This card has no options for a quiz.</Typography>
          )}
        </RadioGroup>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Button
            size="small"
            variant="contained"
            onClick={() => { endQuizHandler(); onExit?.(); }}
            sx={{
              borderRadius:'999px',
              backgroundColor:'var(--color-success)', color:'var(--color-navy-deep)', fontWeight:700,
              '&:hover': { backgroundColor:'var(--color-teal-pale)' },
            }}
          >
            Exit
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default QuizView;
