import React, { useState, useEffect } from 'react';
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
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import { documentService } from '../../services/api';

const shuffleArray = (array) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
};

const QuizView = ({ documentId }) => {
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

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
          // Explicitly use correct_answer, option_2, and option_3 from backend
          // This bypasses the backend issue where option_1 is a duplicate of correct_answer
          const options = [mcq.correct_answer, mcq.option_2, mcq.option_3];
          
          // Shuffle the final 3 options
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
        setIsQuizActive(false);

      } catch (err) {
        console.error("Failed to fetch quiz data:", err);
        setError(err.message || 'Failed to load quiz questions.');
        setQuizQuestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuizData();
  }, [documentId]);

  const startQuizHandler = () => {
    if (quizQuestions.length > 0) {
        setCurrentQuestionIndex(0);
        setUserAnswers({});
        setIsQuizActive(true);
    }
  };

  const endQuizHandler = () => {
    setIsQuizActive(false);
  };

  const handleOptionChange = (event) => {
    const selectedOptionIndex = parseInt(event.target.value, 10);
    setUserAnswers(prevAnswers => ({
      ...prevAnswers,
      [currentQuestionIndex]: selectedOptionIndex,
    }));
  };

  const nextQuestionHandler = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
    }
  };

  const previousQuestionHandler = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prevIndex => prevIndex - 1);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 3 }}>
        <CircularProgress />
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

  if (!isQuizActive) {
    const canStart = totalQuestions > 0;
    const quizTitle = "Test Your Knowledge";

    return (
      <Box 
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4,
          height: '100%',
          textAlign: 'center'
        }}
      >
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
          {quizTitle}
        </Typography>
        {documentId && (
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: '500px' }}>
            {canStart 
              ? `Ready? This quiz contains ${totalQuestions} questions.`
              : `No questions generated for this document yet.`}
          </Typography>
        )}
        {!documentId && (
             <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: '500px' }}>
                Select a document to generate a quiz.
            </Typography>
        )}
        <Button 
          variant="contained" 
          size="large" 
          onClick={startQuizHandler} 
          disabled={!canStart || !documentId}
          sx={{ backgroundColor: '#000' , borderRadius: '20px'}}
        >
          {canStart ? 'Start Quiz' : (documentId ? 'No Questions Found' : 'Select Document')}
        </Button>
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
    if (index === currentQuestionIndex) return 'action.active';
    const answerIndex = userAnswers[index];
    if (answerIndex !== undefined) {
      return answerIndex === quizQuestions[index]?.correctOptionIndex ? 'success.light' : 'error.light'; 
    }
    return 'action.disabledBackground';
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
        maxWidth: '600px', 
        margin: 'auto',
        overflowY: 'auto'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, width: '100%', justifyContent: 'center' }}>
        <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 700 }}>
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
              borderRadius: '4px',
              bgcolor: getProgressSegmentColor(index),
              transition: 'background-color 0.3s ease'
            }}
          />
        ))}
      </Stack>

      <Typography variant="h5" textAlign="center" color="text.primary" sx={{ mb: 4, fontWeight: 'medium' }}>
        {currentCard.question}
      </Typography>

      <RadioGroup
        aria-label="quiz-options"
        name="quiz-options-group"
        value={userAnswers[currentQuestionIndex] !== undefined ? userAnswers[currentQuestionIndex].toString() : ''}
        onChange={handleOptionChange}
        sx={{ width: '100%' }} 
      >
        {(currentCard.options && currentCard.options.length > 0) ? currentCard.options.map((option, index) => (
          <Card
            key={index}
            sx={{
              mb: 1.5,
              borderRadius: '12px',
              border: '1px solid',
              borderColor: userAnswers[currentQuestionIndex] === index ? 'primary.main' : 'divider',
              boxShadow: userAnswers[currentQuestionIndex] === index ? 3 : 0,
              transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
              backgroundColor: 'background.paper' 
            }}
          >
            <CardActionArea onClick={() => handleOptionChange({ target: { value: index.toString() } })}>
              <FormControlLabel
                value={index.toString()} 
                control={<Radio sx={{ ml: 1 }} />} 
                label={option || '(No option text)'}
                sx={{ width: '100%', m: 0, p: 1.5 }} 
              />
            </CardActionArea>
          </Card>
        )) : (
          <Typography color="text.secondary" textAlign="center">This card has no options for a quiz.</Typography>
        )}
      </RadioGroup>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, width: '100%', maxWidth: '500px' }}>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={previousQuestionHandler} 
          disabled={currentQuestionIndex === 0}
          sx={{ borderRadius: '20px', px: 3 , backgroundColor: '#6be0a6'}}
        >
        </Button>
        <Button
          variant="contained" 
          onClick={endQuizHandler} 
          sx={{
            borderRadius: '20px', 
            mx: 1 ,
            backgroundColor: '#ff5454',
          }} 
        >
         exit 
        </Button>
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon />}
          onClick={nextQuestionHandler} 
          disabled={currentQuestionIndex === totalQuestions - 1}
          sx={{ borderRadius: '20px', px: 3 , backgroundColor: '#6be0a6'}}
        >
        </Button>
      </Box>

    </Box>
  );
};

export default QuizView;
