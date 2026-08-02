import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, Card, CardActionArea, FormControlLabel, Radio, RadioGroup, Stack, CircularProgress, Alert } from '@mui/material';

// Accepts mcqs array [{id, question, correct_answer, option_1, option_2, option_3}]
const shuffle = (arr) => {
  const a = [...arr];
  for (let i=a.length-1;i>0;i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
};

const UNANSWERED_SEGMENT_COLOR = 'grey.500'; // adjust shade as desired (e.g. grey.600 or var(--color-border-mid))

const VideoQuiz = ({ mcqs }) => {
  const [questions, setQuestions] = useState([]);
  const [active, setActive] = useState(false);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // {questionIndex: optionIndex}
  const [feedback, setFeedback] = useState(null); // 'correct' | 'incorrect' | null
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const correctAudioRef = useRef(null);
  const wrongAudioRef = useRef(null);

  useEffect(() => {
    if (Array.isArray(mcqs) && mcqs.length) {
      const transformed = mcqs.map((q, i) => {
        const opts = shuffle([q.correct_answer, q.option_1, q.option_2, q.option_3]);
        return { id: q.id, question: q.question, options: opts, correct: opts.indexOf(q.correct_answer) };
      });
      setQuestions(transformed);
  setActive(false); setIdx(0); setAnswers({}); setFeedback(null); setFinished(false); setScore(0);
    } else {
  setQuestions([]); setActive(false); setIdx(0); setAnswers({}); setFeedback(null); setFinished(false); setScore(0);
    }
  }, [mcqs]);

  if (!mcqs) return <CircularProgress size={20} />;

  if (!active) {
    return (
      <Box sx={{ textAlign:'center', p:3 }}>
        <Typography variant="h4" sx={{ mb:2, fontWeight:'bold' }} color='black'>Test Your Knowledge</Typography>
        <Typography variant="body1" color="black" sx={{ mb:3 }}>
          {questions.length ? `This quiz has ${questions.length} questions.` : 'No MCQs generated yet.'}
        </Typography>
        <Button variant="contained" size="large" disabled={!questions.length} onClick={()=>setActive(true)} sx={{ borderRadius: '20px', backgroundColor: 'var(--color-black)'}}>Start Quiz</Button>

      </Box>
    );
  }

  if (!questions.length) {
    return <Alert severity="warning">No MCQs available.</Alert>;
  }

  const current = questions[idx];

  const handleSelect = (value) => {
    // avoid double answers
    if (answers[idx] !== undefined) return;
    const picked = parseInt(value,10);
    const correct = picked === current.correct;
    setAnswers(a => ({ ...a, [idx]: picked }));
    setFeedback(correct ? 'correct' : 'incorrect');
    if (correct) setScore(s => s + 1);
    // audio feedback only
    if (correct) {
      correctAudioRef.current && correctAudioRef.current.play().catch(()=>{});
    } else {
      wrongAudioRef.current && wrongAudioRef.current.play().catch(()=>{});
    }
    // advance after brief delay
    setTimeout(() => {
      setFeedback(null);
      if (idx < questions.length - 1) {
        setIdx(i => i + 1);
      } else {
        setFinished(true); // show results
      }
  }, 1200);
  };

  const colorSegment = (i) => {
    if (i === idx && !finished) return 'primary.main';
    if (answers[i] === undefined) return UNANSWERED_SEGMENT_COLOR;
    return answers[i] === questions[i].correct ? 'success.light' : 'error.light';
  };

  if (finished) {
    return (
      <Box sx={{ p:3, textAlign:'center' }}>
        <Typography variant="h5" sx={{ mb:2, fontWeight:'bold' }} color="black">Results</Typography>
        <Typography variant="body1" sx={{ mb:3 }} color="black">Score: {score} / {questions.length}</Typography>
        {/* <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb:3 }}>
          {questions.map((q,i)=> (
            <Box key={i} sx={{ width:14, height:14, borderRadius:'50%', bgcolor: answers[i]===q.correct ? 'success.main':'error.main' }} />
          ))}
        </Stack> */}
        <Button variant="contained" onClick={()=>{ setActive(false); }} sx={{ borderRadius:'20px', px:4, backgroundColor: 'var(--color-success)'}}>Exit</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p:3, maxWidth:600, mx:'auto' }}>
      {/* Hidden audio elements */}
      <audio ref={correctAudioRef} preload="auto">
        <source src="data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA/////////////////////////////wAAAA8AAAAGAAAGuQCh/////////////////////////////wAAAA8AAAACAAACcQCA/////////////////////////////wAAAA8AAAAGAAAGuQCh/////////////////////////////8AAAANAAAADgAAABH//wAAACQBwAABAgAUABQAAAECAOE4AQABcQQAAcEEAAH//wAAAAgAZGF0Yf//AAD//w==" type="audio/mpeg" />
      </audio>
      <audio ref={wrongAudioRef} preload="auto">
        <source src="data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA/////////////////////////////wAAAA8AAAAGAAAGuQCh/////////////////////////////wAAAA8AAAACAAACcQCA/////////////////////////////wAAAA8AAAAGAAAGuQCh/////////////////////////////8AAAANAAAADgAAABH//wAAACQBwAABAgAUABQAAAECAOE4AQABcQQAAcEEAAH//wAAAAgAZGF0Yf//AAD//w==" type="audio/mpeg" />
      </audio>
      <Box sx={{ display:'flex', justifyContent:'center', mb:2 }}>
        <Typography variant="body2" color="black">{idx+1} of {questions.length}</Typography>
      </Box>
      <Stack direction="row" spacing={0.5} sx={{ width:'80%', mx:'auto', mb:4}}>
        {questions.map((_,i)=>(
          <Box key={i} sx={{ flexGrow:1, height:8, borderRadius:4, bgcolor: colorSegment(i), transition:'background-color .3s' }} />
        ))}
      </Stack>
      <Typography variant="h5" textAlign="center" sx={{ mb:3, fontWeight: 'medium'}} color="black">{current.question}</Typography>
      <Box sx={{ position:'relative' }}>
        {/* Feedback overlay */}
        {feedback && (
          <Box sx={{
            position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
            zIndex:10, pointerEvents:'none',
            '& .fx': { fontSize:90, animation:'pop 0.9s ease forwards', color: feedback === 'correct' ? 'inherit' : 'var(--color-danger-bright)', fontWeight: 'bold' },
            '@keyframes pop': { '0%':{ transform:'scale(.2)', opacity:0 }, '40%':{ transform:'scale(1.05)', opacity:1 }, '100%':{ transform:'scale(1)', opacity:0 } }
          }}>
            <span className="fx">{feedback === 'correct' ? '👏' : '✖'}</span>
          </Box>
        )}
        <RadioGroup value={answers[idx] !== undefined ? String(answers[idx]) : ''}>
          {current.options.map((opt,i)=>(
            <Card key={i} sx={{
              mb:1.5, borderRadius:2, border:'1px solid',
              borderColor: answers[idx]===i ? (answers[idx]===current.correct ? 'success.main':'error.main') : 'divider',
              boxShadow: answers[idx]===i?3:0,
              opacity: answers[idx] !== undefined && answers[idx]!==i ? 0.6:1,
              transition:'all .3s'
            }}>
              <CardActionArea disabled={answers[idx] !== undefined} onClick={()=>handleSelect(String(i))}>
                <FormControlLabel value={String(i)} control={<Radio sx={{ ml:1 }} />} label={opt} sx={{ width:'100%', m:0, p:1.5 }} />
              </CardActionArea>
            </Card>
          ))}
        </RadioGroup>
        <Box sx={{ mt:3, textAlign:'center' }}>
          <Button size="small" variant="contained" color="inherit" onClick={()=>setActive(false)} sx={{ backgroundColor: 'var(--color-success)' }}>Exit</Button>
        </Box>
      </Box>
    </Box>
  );
};

export default VideoQuiz;
