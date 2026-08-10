import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, Card, CardActionArea, FormControlLabel, Radio, RadioGroup, Stack, CircularProgress, Alert } from '@mui/material';
import FocusToggle from '../common/FocusToggle';
import dinoStudy from '../../assets/redlin_logo/dino_study.png';
import { srService } from '../../services/api/sr';
import { useStudySection } from '../../hooks/useStudySession';

// Accepts mcqs array [{question, correct_answer, option_1, option_2, option_3}]
const shuffle = (arr) => {
  const a = [...arr];
  for (let i=a.length-1;i>0;i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
};

const UNANSWERED_SEGMENT_COLOR = 'color-mix(in srgb, var(--color-white) 18%, transparent)';

const VideoQuiz = ({ mcqs, title = 'Test Your Knowledge', focus = false, showStudyImage = false, onFocusChange, onStart, autoStart = false, videoId }) => {
  // Section timer: attribute MCQ practice time to this video source.
  useStudySection({ model: 'video', itemId: videoId, method: 'MCQ' });
  const [questions, setQuestions] = useState([]);
  const [active, setActive] = useState(false);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // {questionIndex: optionIndex}
  const [feedback, setFeedback] = useState(null); // 'correct' | 'incorrect' | null
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const correctAudioRef = useRef(null);
  const startedAtRef = useRef(null);
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

  // Focus Mode: when rendered inside the focus dialog, begin immediately.
  useEffect(() => {
    if (autoStart && !active && questions.length) setActive(true);
  }, [autoStart, active, questions.length]);

  // Start the clock the moment the quiz becomes active.
  useEffect(() => { if (active && !startedAtRef.current) startedAtRef.current = Date.now(); }, [active]);

  if (!mcqs) return <CircularProgress size={20} sx={{ color:'var(--color-teal)' }} />;

  if (!active) {
    return (
      <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', p:3, height:'100%', textAlign:'center' }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight:700, color:'var(--color-white)' }}>{title}</Typography>
        <Typography variant="body1" sx={{ mb:3, maxWidth:520, color:'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>
          {questions.length ? `This quiz has ${questions.length} multiple-choice questions.` : 'No MCQs generated yet.'}
        </Typography>
        <Button
          variant="contained"
          size="large"
          disabled={!questions.length}
          onClick={() => { if (focus) onStart?.(); else setActive(true); }}
          sx={{
            borderRadius:'999px', backgroundColor:'var(--color-success)', color:'var(--color-navy-deep)',
            px:4, fontWeight:700,
            boxShadow:'0 18px 40px color-mix(in srgb, var(--color-success) 24%, transparent)',
            '&:hover': { backgroundColor:'var(--color-teal-pale)' },
            '&.Mui-disabled': { bgcolor:'color-mix(in srgb, var(--color-white) 8%, transparent)', color:'color-mix(in srgb, var(--color-white) 36%, transparent)' },
          }}
        >
          Start Quiz
        </Button>
        <FocusToggle focus={focus} onChange={onFocusChange} />
        {showStudyImage && (
          <img src={dinoStudy} alt="Start studying" style={{ width: 'auto', height: 300, maxWidth: '100%', objectFit: 'contain', display: 'block', margin: '20px auto 0' }} />
        )}
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
    // Feed the SR/stats engine (fire-and-forget).
    srService.submitAttempt({ model: 'video_mcq', item_id: current.id, method: 'MCQ', correct }).then(() => {}).catch(() => {});
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
    if (i === idx && !finished) return 'color-mix(in srgb, var(--color-success) 95%, transparent)';
    if (answers[i] === undefined) return UNANSWERED_SEGMENT_COLOR;
    return answers[i] === questions[i].correct
      ? 'color-mix(in srgb, var(--color-success) 78%, transparent)'
      : 'color-mix(in srgb, var(--color-danger-softer) 82%, transparent)';
  };

  if (finished) {
    const elapsedSec = startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : 0;
    const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
    return (
      <Box sx={{ p:3, textAlign:'center', maxWidth:760, mx:'auto' }}>
        <Typography variant="h5" sx={{ mb:2, fontWeight:700, color:'var(--color-white)' }}>Results</Typography>
        <Typography variant="body1" sx={{ mb:0.5, color:'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>Time: {Math.floor(elapsedSec / 60)}m {elapsedSec % 60}s</Typography>
        <Typography variant="body1" sx={{ mb:3, color:'var(--color-teal)', fontWeight:700 }}>{pct}% · {score} / {questions.length} correct</Typography>
        <Button
          variant="contained"
          onClick={()=>{ setActive(false); }}
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

  return (
    <Box sx={{ p:3, maxWidth:700, mx:'auto' }}>
      {/* Hidden audio elements */}
      <audio ref={correctAudioRef} preload="auto">
        <source src="data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA/////////////////////////////wAAAA8AAAAGAAAGuQCh/////////////////////////////wAAAA8AAAACAAACcQCA/////////////////////////////wAAAA8AAAAGAAAGuQCh/////////////////////////////8AAAANAAAADgAAABH//wAAACQBwAABAgAUABQAAAECAOE4AQABcQQAAcEEAAH//wAAAAgAZGF0Yf//AAD//w==" type="audio/mpeg" />
      </audio>
      <audio ref={wrongAudioRef} preload="auto">
        <source src="data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA/////////////////////////////wAAAA8AAAAGAAAGuQCh/////////////////////////////wAAAA8AAAACAAACcQCA/////////////////////////////wAAAA8AAAAGAAAGuQCh/////////////////////////////8AAAANAAAADgAAABH//wAAACQBwAABAgAUABQAAAECAOE4AQABcQQAAcEEAAH//wAAAAgAZGF0Yf//AAD//w==" type="audio/mpeg" />
      </audio>
      <Box sx={{ display:'flex', justifyContent:'center', mb:1.5 }}>
        <Typography variant="body2" sx={{ color:'color-mix(in srgb, var(--color-white) 74%, transparent)', fontWeight:600 }}>{idx+1} of {questions.length}</Typography>
      </Box>
      <Stack direction="row" spacing={0.5} sx={{ width:'80%', mx:'auto', mb:4}}>
        {questions.map((_,i)=>(
          <Box key={i} sx={{
            flexGrow:1, height:8, borderRadius:999,
            bgcolor: colorSegment(i),
            transition:'background-color .3s ease, box-shadow .3s ease',
            boxShadow: i === idx && !finished ? '0 0 0 3px color-mix(in srgb, var(--color-success) 12%, transparent)' : 'none',
          }} />
        ))}
      </Stack>
      <Typography variant="h5" textAlign="center" sx={{ mb:3, fontWeight:600, lineHeight:1.4, color:'var(--color-white)' }}>{current.question}</Typography>
      <Box sx={{ position:'relative' }}>
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
        <RadioGroup value={answers[idx] !== undefined ? String(answers[idx]) : ''}>
          {current.options.map((opt,i)=>{
            const answered = answers[idx] === i;
            const isCorrect = answered && answers[idx] === current.correct;
            return (
            <Card key={i} sx={{
              mb:1.5, borderRadius:2, border:'1px solid',
              borderColor: answered
                ? (isCorrect ? 'color-mix(in srgb, var(--color-success) 90%, transparent)' : 'color-mix(in srgb, var(--color-danger-softer) 90%, transparent)')
                : 'color-mix(in srgb, var(--color-white) 8%, transparent)',
              boxShadow: answered ? 3 : 0,
              opacity: answers[idx] !== undefined && !answered ? 0.66 : 1,
              backgroundColor: answered
                ? (isCorrect ? 'color-mix(in srgb, var(--color-success) 10%, transparent)' : 'color-mix(in srgb, var(--color-danger-softer) 8%, transparent)')
                : 'color-mix(in srgb, var(--color-white) 3%, transparent)',
              transition:'all .3s',
            }}>
              <CardActionArea disabled={answers[idx] !== undefined} onClick={()=>handleSelect(String(i))} sx={{ borderRadius:2 }}>
                <FormControlLabel
                  value={String(i)}
                  control={
                    <Radio sx={{
                      ml:1,
                      color:'color-mix(in srgb, var(--color-white) 50%, transparent)',
                      '&.Mui-checked': { color: isCorrect ? 'var(--color-success)' : 'var(--color-danger-softer)' },
                    }} />
                  }
                  label={opt}
                  sx={{ width:'100%', m:0, p:1.5, '& .MuiFormControlLabel-label': { color:'var(--color-white)', fontSize:15, lineHeight:1.45 } }}
                />
              </CardActionArea>
            </Card>
            );
          })}
        </RadioGroup>
        <Box sx={{ mt:3, textAlign:'center' }}>
          <Button
            size="small"
            variant="contained"
            onClick={()=>setActive(false)}
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

export default VideoQuiz;
