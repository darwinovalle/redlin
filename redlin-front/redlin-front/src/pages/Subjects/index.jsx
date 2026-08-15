import React, { useEffect, useState, useCallback } from 'react';
import { topicsService } from '../../services/api/topics';
import { srService } from '../../services/api/sr';
import ActiveReviewModal from '../../components/Review/ActiveReviewModal';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import CloseIcon from '@mui/icons-material/Close';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useNavigate } from 'react-router-dom';

// Accent swatches for a New subject. #20C997 is the app's teal (--color-teal).
const PALETTE = ['#20C997', '#38BDF8', '#6366F1', '#A855F7', '#F43F5E', '#F59E0B', '#22C55E'];

const SOURCE_LABEL = (s) => ({ video: 'Video', document: 'Document', lecture: 'Lecture' }[s] || s);

// "MCQ: 3 · CLOZE: 2 · FEYNMAN: 1" summary for a review group.
const methodCounts = (g) => {
  const counts = {};
  for (const it of g.items || []) counts[it.method] = (counts[it.method] || 0) + 1;
  return Object.entries(counts).map(([m, n]) => `${m}: ${n}`).join(' · ') || '—';
};

const NewSubjectDialog = ({ open, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [emoji, setEmoji] = useState('🧠');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [disabled, setDisabled] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || disabled) return;
    setError(null); setCreating(true); setDisabled(true);
    try {
      const topic = await topicsService.createTopic({ name: name.trim(), color, emoji: emoji || '🧠' });
      onCreated?.(topic);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to create subject.');
      setCreating(false); setDisabled(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={creating ? null : onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        style: { background: 'linear-gradient(135deg, var(--color-navy-050) 0%, var(--color-navy-200) 48%, var(--color-navy) 100%)' },
        sx: {
          width: { xs: '92vw', sm: 460 }, maxWidth: '92vw', borderRadius: '20px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)', overflow: 'hidden', position: 'relative',
        },
      }}
      slotProps={{ backdrop: { sx: { backgroundColor: 'color-mix(in srgb, var(--color-black) 60%, transparent)' } } }}
    >
      {/* teal / blue glows */}
      <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at top left, color-mix(in srgb, var(--color-teal) 18%, transparent), transparent 45%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--color-blue) 20%, transparent), transparent 48%)' }} />

      <Box sx={{ position: 'relative', p: { xs: 2.5, md: 3.5 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--color-teal) 18%, transparent)', color: 'var(--color-teal)' }}>
              <ViewKanbanIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: 'var(--color-white)', fontWeight: 700, letterSpacing: '-0.01em' }}>New subject</Typography>
              <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 62%, transparent)' }}>
                Create a study subject to open its kanban board. Attach your documents, videos, books and lectures as study-material cards to track progress.
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} disabled={creating} size="small" sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'center' }}>
          <TextField
            inputProps={{ maxLength: 3, style: { textAlign: 'center' } }}
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            disabled={creating}
            sx={{ width: 76 }}
          />
          <TextField
            fullWidth
            autoFocus
            label="Subject name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={creating}
            inputProps={{ maxLength: 80 }}
            sx={{ '& .MuiOutlinedInput-root': { color: 'var(--color-white)', backgroundColor: 'color-mix(in srgb, var(--color-white) 4%, transparent)', '& fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 14%, transparent)' }, '&:hover fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 24%, transparent)' }, '&.Mui-focused fieldset': { borderColor: 'var(--color-teal)' } }, '& .MuiInputLabel-root': { color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' } }}
          />
        </Box>

        <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)', display: 'block', mb: 1 }}>Accent color</Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {PALETTE.map((c) => (
            <Box
              key={c}
              onClick={() => !creating && setColor(c)}
              sx={{
                width: 30, height: 30, borderRadius: '50%', backgroundColor: c, cursor: 'pointer',
                border: color === c ? '3px solid var(--color-white)' : '3px solid transparent',
                transition: 'border .15s',
              }}
            />
          ))}
        </Box>

        <Button
          variant="contained" fullWidth onClick={handleCreate}
          disabled={disabled || !name.trim()}
          sx={{ borderRadius: '999px', py: 1.15, background: 'var(--color-teal)', color: 'var(--color-navy-deep)', fontWeight: 700, textTransform: 'none', boxShadow: '0 10px 28px color-mix(in srgb, var(--color-teal) 30%, transparent)', '&:hover': { background: 'var(--color-teal-pale)' }, '&.Mui-disabled': { bgcolor: 'color-mix(in srgb, var(--color-white) 8%, transparent)', color: 'color-mix(in srgb, var(--color-white) 36%, transparent)' } }}
        >
          {creating ? 'Creating…' : 'Create subject'}
        </Button>

        {error && !creating && <Box sx={{ mt: 2 }}>{error}</Box>}
      </Box>
    </Dialog>
  );
};

const Subjects = () => {
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  // Due-for-review groups (one per study source), each with its own quiz.
  const [due, setDue] = useState({ count: 0, groups: [] });
  const [dueLoading, setDueLoading] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);

  const fetchTopics = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const list = await topicsService.listTopics();
      setTopics(list);
    } catch (e) {
      setError(e?.message || 'Could not load subjects.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  const fetchDue = useCallback(async () => {
    setDueLoading(true);
    try {
      const d = await srService.getDue();
      setDue(d || { count: 0, groups: [] });
    } catch {
      setDue({ count: 0, groups: [] });
    } finally { setDueLoading(false); }
  }, []);

  useEffect(() => { fetchDue(); }, [fetchDue]);

  const columnCount = (topic) =>
    (topic?.board?.columns || []).map((c) => ({ title: c.title, count: (c.cards || []).length }));

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', overflowX: 'hidden', background: 'radial-gradient(circle, color-mix(in srgb, var(--color-navy) 30%, transparent) 1px, transparent 1.5px), #FFFFFF', backgroundSize: '22px 22px' }}>
      {/* Hero — full-width navy panel with decorative glow bubbles */}
      <Box sx={{ position: 'relative', width: '100%', mb: { xs: 4, md: 6 }, overflow: 'hidden', background: 'var(--color-navy-deep)' }}>
        <Box sx={{ position: 'absolute', top: -80, right: -40, width: 288, height: 288, borderRadius: '50%', background: 'radial-gradient(circle, rgba(127, 99, 244, 0.35), transparent 70%)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', bottom: -96, left: '33.33%', width: 288, height: 288, borderRadius: '50%', background: 'radial-gradient(circle, rgba(32, 201, 151, 0.3), transparent 70%)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'relative', maxWidth: 1500, mx: 'auto', px: { xs: '24px', md: '40px' }, py: { xs: '48px', md: '64px' } }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-teal)', mb: 2 }}>
            Your subjects
          </Box>
          <Typography component="h1" sx={{ fontFamily: "'Poppins', 'Titillium Web', sans-serif", fontWeight: 700, lineHeight: 1.1, fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', color: 'var(--color-white)' }}>
            Subjects
          </Typography>
          <Typography sx={{ color: '#B0B7C3', mt: 1.5, maxWidth: 672, fontSize: 15, lineHeight: 1.6 }}>
            Organize your study around subjects. Each subject has a kanban board where you attach your documents, videos, books and lectures as study-material cards to track progress.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)} sx={{ mt: 3.5, height: 48, px: 3, borderRadius: '999px', backgroundColor: 'var(--color-teal)', color: 'var(--color-white)', fontWeight: 600, fontSize: 14, textTransform: 'none', boxShadow: '0 6px 20px rgba(32, 201, 151, 0.5)', transition: 'all .2s ease', '&:hover': { backgroundColor: 'var(--color-teal-hover)', transform: 'translateY(-2px)' } }}>
            New subject
          </Button>
        </Box>
      </Box>

      <Box sx={{ p: { xs: 3, md: 6, lg: 7 }, pt: 0 }}>

      {error && <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: 'color-mix(in srgb, var(--color-danger-soft) 14%, transparent)' }}>{error}</Box>}

      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 12 }}><CircularProgress sx={{ color: 'var(--color-teal)' }} /></Box>
      ) : topics.length === 0 ? (
        <Box sx={{ mt: 6, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 3 }}>
          {[0, 1, 2].map((i) => (
            <button key={i} onClick={() => setOpen(true)} style={{ cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }}>
              <Box sx={{ p: 3, borderRadius: 4, border: '2px dashed color-mix(in srgb, var(--color-navy) 45%, transparent)', background: 'var(--color-white)', minHeight: 170, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', boxShadow: '0 6px 18px color-mix(in srgb, var(--color-navy) 7%, transparent)', '&:hover': { borderColor: 'var(--color-teal)' } }}>
                <AddIcon sx={{ fontSize: 40, color: 'color-mix(in srgb, var(--color-navy) 55%, transparent)', mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>New subject</Typography>
                <Typography variant="body2" sx={{ color: 'var(--color-text-mid)' }}>
                  Start a kanban board for a subject you're studying.
                </Typography>
              </Box>
            </button>
          ))}
        </Box>
      ) : (
        <Box sx={{ mt: 4, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 3 }}>
          {topics.map((t) => (
            <Box
              key={t.id}
              onClick={() => navigate(`/subjects/${t.id}`)}
              role="button"
              tabIndex={0}
              sx={{
                cursor: 'pointer', borderRadius: 4, overflow: 'hidden', background: 'linear-gradient(135deg, var(--color-navy-050) 0%, var(--color-navy-200) 48%, var(--color-navy) 100%)',
                border: '1px solid color-mix(in srgb, var(--color-white) 12%, transparent)',
                transition: 'transform .2s, border .2s',
                '&:hover': { transform: 'translateY(-3px)', borderColor: 'color-mix(in srgb, var(--color-teal) 55%, transparent)' },
              }}
            >
              <Box sx={{ height: 6, bgcolor: t.color || 'var(--color-teal)' }} />
              <Box sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, background: `color-mix(in srgb, ${t.color || 'var(--color-teal)'} 18%, transparent)` }}>{t.emoji || '🧠'}</Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)' }}>{t.board ? `${t.board.columns.filter((c) => (c.cards || []).length > 0).length} active column` : 'board'}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {columnCount(t).map((c) => (
                    <Chip key={c.title} size="small" label={`${c.title}: ${c.count}`} sx={{ color: 'color-mix(in srgb, var(--color-white) 80%, transparent)', bgcolor: 'color-mix(in srgb, var(--color-white) 8%, transparent)', fontSize: 12 }} />
                  ))}
                </Box>
              </Box>
            </Box>
          ))}
          <Box onClick={() => setOpen(true)} sx={{ cursor: 'pointer', p: 3, borderRadius: 4, border: '2px dashed color-mix(in srgb, var(--color-navy) 45%, transparent)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: 'var(--color-white)', boxShadow: '0 6px 18px color-mix(in srgb, var(--color-navy) 7%, transparent)', '&:hover': { borderColor: 'var(--color-teal)' } }}>
            <AddIcon sx={{ fontSize: 40, color: 'color-mix(in srgb, var(--color-navy) 55%, transparent)' }} />
            <Typography sx={{ fontWeight: 700, color: 'var(--color-text)' }}>New subject</Typography>
          </Box>
        </Box>
      )}

      {/* Due for review — one graded review table per study source */}
      <Box sx={{ mt: 7 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>Due for review</Typography>
          {due.count > 0 && <Chip size="small" label={`${due.count} due`} sx={{ color: 'var(--color-teal)', bgcolor: 'color-mix(in srgb, var(--color-teal) 16%, transparent)', fontSize: 12 }} />}
        </Box>
        <Typography variant="body2" sx={{ color: 'var(--color-text-mid)', mb: 2 }}>
          The spaced-repetition engine scheduled these for you. Each source has its own graded review — real questions, tested against real answers.
        </Typography>

        {dueLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress sx={{ color: 'var(--color-teal)' }} /></Box>
        ) : (due.groups || []).length === 0 ? (
          <Box sx={{ p: 3, borderRadius: 3, border: '1px dashed color-mix(in srgb, var(--color-navy) 35%, transparent)', bgcolor: 'var(--color-white)', color: 'var(--color-text-mid)', fontStyle: 'italic' }}>
            Nothing due right now. Answer MCQs, Cloze and Feynman questions while you study — the engine schedules the reviews for you.
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {(due.groups || []).map((g) => (
              <Box key={`${g.source}-${g.source_id}`} sx={{ p: 2.5, borderRadius: 3, border: '1px solid color-mix(in srgb, var(--color-navy) 14%, transparent)', bgcolor: 'var(--color-white)', boxShadow: '0 6px 18px color-mix(in srgb, var(--color-navy) 7%, transparent)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Chip size="small" label={SOURCE_LABEL(g.source)} sx={{ color: 'var(--color-teal)', bgcolor: 'color-mix(in srgb, var(--color-teal) 14%, transparent)', fontSize: 11 }} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.title}</Typography>
                    {g.subtitle && <Typography variant="caption" sx={{ color: 'var(--color-text-mid)' }}>{g.subtitle}</Typography>}
                  </Box>
                  <Typography variant="caption" sx={{ color: 'var(--color-text-mid)' }}>{methodCounts(g)}</Typography>
                  <Button
                    onClick={() => setActiveGroup(g)}
                    startIcon={<PlayArrowIcon />}
                    sx={{ borderRadius: 999, px: 2.5, background: 'var(--color-teal)', color: 'var(--color-white)', fontWeight: 700, textTransform: 'none', '&:hover': { background: 'var(--color-teal-hover)' } }}
                  >
                    Play review
                  </Button>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
      </Box>

      {open && <NewSubjectDialog open onClose={() => setOpen(false)} onCreated={() => { setOpen(false); fetchTopics(); }} />}
      <ActiveReviewModal open={!!activeGroup} group={activeGroup} onClose={() => setActiveGroup(null)} onRefresh={fetchDue} />
    </Box>
  );
};

export default Subjects;