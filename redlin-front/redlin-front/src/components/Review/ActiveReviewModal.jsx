import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { srService } from '../../services/api/sr';
import FeynmanAttemptForm from '../Feynman/FeynmanAttemptForm';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';

// Fisher–Yates shuffle of a copy (MCQ options are presented in a fresh order
// every session so position never gives the answer away).
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Same normalization the backend uses for cloze validation (_cmp).
const normalize = (s) => (s || '').trim().toLowerCase();

// Light cleanup of the cloze sentence for display (strip markdown noise, keep
// the blank token).
const clozeDisplay = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/_{4,6}/g, '_____')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const SOURCE_LABELS = { video: 'Video', document: 'Document', lecture: 'Lecture' };

const MethodChip = ({ label }) => (
  <Chip size="small" label={label} sx={{ color: 'var(--color-teal)', bgcolor: 'color-mix(in srgb, var(--color-teal) 16%, transparent)', fontSize: 11 }} />
);

const ResultStat = ({ label, value, color }) => (
  <Box sx={{ textAlign: 'center', minWidth: 92, p: 2, borderRadius: 3, border: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)', bgcolor: 'color-mix(in srgb, var(--color-white) 4%, transparent)' }}>
    <Typography sx={{ fontSize: 26, fontWeight: 800, color }}>{value}</Typography>
    <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)' }}>{label}</Typography>
  </Box>
);

/**
 * ActiveReviewModal — a focused, graded review session for one study source.
 *
 * Walks the due items of a single group (video / document / chapter / lecture)
 * one at a time and actually tests the user:
 *   - MCQ      picks an option, graded against the stored correct answer
 *   - Cloze    fills the blank, graded with the same normalization as the API
 *   - Feynman  writes an explanation, graded by the AI evaluator (0-100)
 * Passed items reschedule on the normal SM-2 ladder; failed ones come back in
 * ~6 hours. "Skip" and "End session" record nothing, so those items stay due.
 */
const ActiveReviewModal = ({ open, group, onClose, onRefresh }) => {
  const items = group?.items || [];
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState([]); // 'correct' | 'wrong' | 'skipped'
  const [phase, setPhase] = useState('answering'); // answering | revealed
  const [selected, setSelected] = useState(null);
  const [clozeInput, setClozeInput] = useState('');
  const [feynmanAnswer, setFeynmanAnswer] = useState('');
  const [feynmanResult, setFeynmanResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState([]);

  // Fresh session whenever the modal (re)opens for a group.
  useEffect(() => {
    if (!open) return;
    setIndex(0);
    setResults([]);
    setPhase('answering');
    setSelected(null);
    setClozeInput('');
    setFeynmanAnswer('');
    setFeynmanResult(null);
    setBusy(false);
  }, [open, group]);

  const item = items[index];
  const detail = item?.detail;
  // The body renders the question ONLY while an item exists. When the dialog is
  // closed (group null) or the session is over, `item` is undefined and we show
  // the summary (invisible while closed). Guarding on `open` alone is wrong:
  // a closed dialog short-circuits `open && item == null` to false, which would
  // fall through to the question branch with an undefined item → crash.
  const finished = item == null;
  const isLast = index >= items.length - 1;
  const current = index + 1;

  // Fresh shuffle of MCQ options whenever the current question changes.
  useEffect(() => {
    if (detail?.type === 'mcq' && Array.isArray(detail.options)) {
      setOptions(shuffle(detail.options));
    } else {
      setOptions([]);
    }
  }, [item?.progress_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const record = (i, outcome) => {
    setResults((prev) => { const n = [...prev]; n[i] = outcome; return n; });
  };

  const endSession = () => {
    onClose?.();
    onRefresh?.();
  };

  const gradeMcq = async (opt) => {
    if (busy || phase !== 'answering') return;
    const correct = opt === detail.correct_answer;
    setSelected(opt);
    setPhase('revealed');
    setBusy(true);
    try {
      await srService.submitAttempt({ content_type_id: item.content_type_id, object_id: item.object_id, method: 'MCQ', correct });
    } catch (e) {
      console.error('Failed to record MCQ attempt', e);
    } finally {
      record(index, correct ? 'correct' : 'wrong');
      setBusy(false);
    }
  };

  const gradeCloze = async () => {
    if (busy || phase !== 'answering' || !clozeInput.trim()) return;
    const correct = normalize(clozeInput) === normalize(detail.answer);
    setPhase('revealed');
    setBusy(true);
    try {
      await srService.submitAttempt({ content_type_id: item.content_type_id, object_id: item.object_id, method: 'CLOZE', correct });
    } catch (e) {
      console.error('Failed to record cloze attempt', e);
    } finally {
      record(index, correct ? 'correct' : 'wrong');
      setBusy(false);
    }
  };

  const gradeFeynman = async () => {
    if (busy || phase !== 'answering' || !feynmanAnswer.trim()) return;
    setBusy(true);
    try {
      const res = await srService.evaluateReviewFeynman({
        content_type_id: item.content_type_id, object_id: item.object_id, answer: feynmanAnswer,
      });
      setFeynmanResult(res);
      setPhase('revealed');
      record(index, res.passed ? 'correct' : 'wrong');
    } catch (e) {
      console.error('Feynman evaluation failed', e);
      setFeynmanResult({ error: e?.response?.data?.error || 'Evaluation failed' });
      setPhase('revealed');
      record(index, 'skipped'); // not graded -> stays due
    } finally {
      setBusy(false);
    }
  };

  const advance = () => {
    setSelected(null);
    setClozeInput('');
    setFeynmanAnswer('');
    setFeynmanResult(null);
    setPhase('answering');
    setIndex((i) => i + 1);
  };

  const skip = () => {
    if (busy) return;
    if (results[index] == null) record(index, 'skipped');
    advance();
  };

  const correctCount = results.filter((r) => r === 'correct').length;
  const wrongCount = results.filter((r) => r === 'wrong').length;
  const skippedCount = results.filter((r) => r === 'skipped').length;
  const progressLabel = finished ? 'Session complete' : `${Math.min(current, items.length)} of ${items.length}`;

  return (
    <Dialog
      open={open}
      onClose={endSession}
      fullScreen
      PaperProps={{ sx: { background: 'var(--color-navy-deep)', color: 'var(--color-white)' } }}
      slotProps={{ backdrop: { sx: { backgroundColor: 'color-mix(in srgb, var(--color-black) 92%, transparent)' } } }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ px: { xs: 2.5, md: 4 }, py: 2, borderBottom: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <MethodChip label={SOURCE_LABELS[group?.source] || (group?.source || '').toUpperCase()} />
              <Typography sx={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group?.title}</Typography>
            </Box>
            {group?.subtitle && (
              <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)' }}>{group.subtitle}</Typography>
            )}
          </Box>
          <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 65%, transparent)', whiteSpace: 'nowrap' }}>{progressLabel}</Typography>
          <Button size="small" onClick={endSession} disabled={busy} sx={{ borderRadius: 999, px: 2, color: 'var(--color-white)', border: '1px solid color-mix(in srgb, var(--color-white) 22%, transparent)', textTransform: 'none', fontWeight: 600 }}>End session</Button>
          <IconButton onClick={endSession} size="small" sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        {/* Progress bar */}
        <Box sx={{ height: 3, bgcolor: 'color-mix(in srgb, var(--color-white) 8%, transparent)' }}>
          <Box sx={{ height: '100%', width: finished ? '100%' : `${(Math.min(current, items.length) / Math.max(1, items.length)) * 100}%`, background: 'linear-gradient(90deg, var(--color-teal), var(--color-blue))', transition: 'width .25s' }} />
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 } }}>
          {finished ? (
            <Box sx={{ width: '100%', maxWidth: 560, textAlign: 'center' }}>
              <Box sx={{ width: 72, height: 72, borderRadius: '50%', display: 'grid', placeItems: 'center', mx: 'auto', mb: 2, background: 'color-mix(in srgb, var(--color-teal) 18%, transparent)' }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 36, color: 'var(--color-teal)' }} />
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: 24, mb: 0.5 }}>Review complete</Typography>
              <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 62%, transparent)', mb: 3 }}>
                {items.length} question{items.length === 1 ? '' : 's'} in this session.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 3, flexWrap: 'wrap' }}>
                <ResultStat label="Recalled" value={correctCount} color="var(--color-teal)" />
                <ResultStat label="Missed" value={wrongCount} color="var(--color-danger-soft)" />
                <ResultStat label="Skipped" value={skippedCount} color="color-mix(in srgb, var(--color-white) 62%, transparent)" />
              </Box>
              <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)', mb: 3, maxWidth: 420, mx: 'auto' }}>
                Missed and skipped questions stay due — they come back for another try in about 6 hours.
              </Typography>
              <Button variant="contained" onClick={endSession} sx={{ borderRadius: 999, px: 4, py: 1.2, background: 'var(--color-teal)', color: 'var(--color-navy-deep)', fontWeight: 700, textTransform: 'none', '&:hover': { background: 'var(--color-teal-pale)' } }}>Close</Button>
            </Box>
          ) : (
            <Box sx={{ width: '100%', maxWidth: 720 }}>
              {detail?.type !== 'cloze' && (
                <Box sx={{ mb: 3 }}>
                  <MethodChip label={item.method} />
                  <Typography sx={{ mt: 2, fontSize: { xs: 18, md: 22 }, fontWeight: 600, lineHeight: 1.4 }}>{item.question}</Typography>
                </Box>
              )}

              {!detail && (
                <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)', fontStyle: 'italic' }}>
                  Question data unavailable. Skip to continue.
                </Typography>
              )}

              {/* MCQ */}
              {detail?.type === 'mcq' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  {options.map((opt) => {
                    const isCorrectOpt = detail.correct_answer === opt;
                    const isSelected = selected === opt;
                    let bg = 'color-mix(in srgb, var(--color-white) 5%, transparent)';
                    let border = '1px solid color-mix(in srgb, var(--color-white) 12%, transparent)';
                    if (phase === 'revealed') {
                      if (isCorrectOpt) { bg = 'color-mix(in srgb, var(--color-teal) 20%, transparent)'; border = '1px solid var(--color-teal)'; }
                      else if (isSelected) { bg = 'color-mix(in srgb, var(--color-danger-soft) 20%, transparent)'; border = '1px solid var(--color-danger-soft)'; }
                      else { bg = 'color-mix(in srgb, var(--color-white) 3%, transparent)'; border = '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)'; }
                    }
                    return (
                      <Button
                        key={opt}
                        disabled={phase === 'revealed' || busy}
                        onClick={() => gradeMcq(opt)}
                        sx={{ justifyContent: 'flex-start', textAlign: 'left', textTransform: 'none', borderRadius: 2.5, px: 2.5, py: 1.5, bgcolor: bg, color: 'var(--color-white)', border, fontWeight: 600, fontSize: 15, '&:hover': { bgcolor: phase === 'revealed' ? bg : 'color-mix(in srgb, var(--color-teal) 12%, transparent)' } }}
                      >
                        {opt}
                      </Button>
                    );
                  })}
                </Box>
              )}

              {/* Cloze */}
              {detail?.type === 'cloze' && (
                <Box>
                  <Box sx={{ mb: 1.5 }}><MethodChip label={item.method} /></Box>
                  <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: 'color-mix(in srgb, var(--color-white) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)', mb: 2 }}>
                    <Typography sx={{ fontSize: 17, lineHeight: 1.6 }}>
                      {clozeDisplay(detail.text_with_blank).split('_____').map((part, i, arr) => (
                        <React.Fragment key={i}>
                          {part}
                          {i < arr.length - 1 && (
                            <Box component="span" sx={{ display: 'inline-block', minWidth: 96, borderBottom: '2px solid var(--color-teal)', px: 0.5, mx: 0.5, color: 'var(--color-teal)' }}>{clozeInput || '…'}</Box>
                          )}
                        </React.Fragment>
                      ))}
                    </Typography>
                  </Box>
                  <TextField
                    value={clozeInput}
                    onChange={(e) => setClozeInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') gradeCloze(); }}
                    disabled={phase === 'revealed' || busy}
                    fullWidth
                    label="Your answer"
                    placeholder="Type the missing word…"
                    sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { color: 'var(--color-white)', '& fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 14%, transparent)' }, '&:hover fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 24%, transparent)' }, '&.Mui-focused fieldset': { borderColor: 'var(--color-teal)' } }, '& .MuiInputLabel-root': { color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' } }}
                  />
                  {phase === 'revealed' && (
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: normalize(clozeInput) === normalize(detail.answer) ? 'var(--color-teal)' : 'var(--color-danger-soft)' }}>
                      {normalize(clozeInput) === normalize(detail.answer) ? 'Correct!' : `Answer: ${detail.answer}`}
                    </Typography>
                  )}
                  <Button variant="contained" onClick={gradeCloze} disabled={phase === 'revealed' || busy || !clozeInput.trim()} sx={{ borderRadius: 999, px: 3, background: 'var(--color-teal)', color: 'var(--color-navy-deep)', fontWeight: 700, textTransform: 'none', '&:hover': { background: 'var(--color-teal-pale)' } }}>Check answer</Button>
                </Box>
              )}

              {/* Feynman — reuse the panel's dictation-enabled attempt form
                  (mic + whisper fallback) so the review behaves like the panels. */}
              {detail?.type === 'feynman' && (
                <Box>
                  <FeynmanAttemptForm
                    value={feynmanAnswer}
                    onChange={setFeynmanAnswer}
                    onSubmit={gradeFeynman}
                    disabled={phase === 'revealed' || busy}
                    language="en"
                  />
                  {busy && phase === 'answering' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <CircularProgress size={16} sx={{ color: 'var(--color-teal)' }} />
                      <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>Grading your explanation…</Typography>
                    </Box>
                  )}
                  {phase === 'revealed' && feynmanResult && (
                    <Box sx={{ mt: 2, p: 2.5, borderRadius: 3, border: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)', bgcolor: 'color-mix(in srgb, var(--color-white) 4%, transparent)' }}>
                      {feynmanResult.error ? (
                        <Typography sx={{ color: 'var(--color-danger-soft)', fontWeight: 600 }}>{feynmanResult.error}</Typography>
                      ) : (
                        <>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
                            <Typography sx={{ fontWeight: 800, fontSize: 24, color: feynmanResult.passed ? 'var(--color-teal)' : 'var(--color-danger-soft)' }}>{feynmanResult.score}%</Typography>
                            <Chip size="small" label={feynmanResult.passed ? 'Understood' : 'Needs review'} sx={{ color: feynmanResult.passed ? 'var(--color-teal)' : 'var(--color-danger-soft)', bgcolor: `color-mix(in srgb, ${feynmanResult.passed ? 'var(--color-teal)' : 'var(--color-danger-soft)'} 16%, transparent)`, fontSize: 11 }} />
                          </Box>
                          {feynmanResult.feedback && (
                            <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 78%, transparent)', lineHeight: 1.5 }}>{feynmanResult.feedback}</Typography>
                          )}
                        </>
                      )}
                    </Box>
                  )}
                </Box>
              )}

              {/* Bottom controls */}
              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Button size="small" onClick={skip} disabled={busy} startIcon={<SkipNextIcon />} sx={{ borderRadius: 999, px: 2.5, color: 'color-mix(in srgb, var(--color-white) 70%, transparent)', textTransform: 'none', fontWeight: 600 }}>Skip</Button>
                {phase === 'revealed' ? (
                  <Button variant="contained" onClick={advance} sx={{ borderRadius: 999, px: 4, background: 'var(--color-teal)', color: 'var(--color-navy-deep)', fontWeight: 700, textTransform: 'none', '&:hover': { background: 'var(--color-teal-pale)' } }}>
                    {isLast ? 'Finish' : 'Next'}
                  </Button>
                ) : (
                  <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 45%, transparent)' }}>Answer to continue, or skip.</Typography>
                )}
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Dialog>
  );
};

MethodChip.propTypes = { label: PropTypes.string.isRequired };
ResultStat.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  color: PropTypes.string.isRequired,
};
ActiveReviewModal.propTypes = {
  open: PropTypes.bool,
  group: PropTypes.shape({
    source: PropTypes.string,
    source_id: PropTypes.number,
    title: PropTypes.string,
    subtitle: PropTypes.string,
    items: PropTypes.array,
  }),
  onClose: PropTypes.func,
  onRefresh: PropTypes.func,
};

export default ActiveReviewModal;
