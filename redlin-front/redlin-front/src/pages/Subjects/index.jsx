import React, { useEffect, useState, useCallback } from 'react';
import { topicsService } from '../../services/api/topics';
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
import { useNavigate } from 'react-router-dom';

// Accent swatches for a New subject. #14B8A6 is the app's teal (--color-teal).
const PALETTE = ['#14B8A6', '#38BDF8', '#6366F1', '#A855F7', '#F43F5E', '#F59E0B', '#22C55E'];

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
      PaperProps={{
        style: { backgroundColor: '#1A2A3A' },
        sx: {
          width: { xs: '92vw', sm: 460 }, maxWidth: '92vw', borderRadius: '20px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)', overflow: 'hidden', position: 'relative',
        },
      }}
      slotProps={{ backdrop: { sx: { backgroundColor: 'color-mix(in srgb, var(--color-black) 60%, transparent)' } } }}
    >
      <Box sx={{ position: 'relative', p: { xs: 2.5, md: 3.5 } }}>
        <IconButton aria-label="close" onClick={onClose} disabled={creating} size="small" sx={{ position: 'absolute', right: 12, top: 12, zIndex: 2, color: 'rgba(255,255,255,0.6)', '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-white)' } }}>
          <CloseIcon fontSize="small" />
        </IconButton>

        <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: '14px', background: 'color-mix(in srgb, var(--color-teal) 16%, transparent)', mb: 1.25 }}>
          <ViewKanbanIcon sx={{ fontSize: 26, color: 'var(--color-teal)' }} />
        </Box>
        <Typography variant="h5" sx={{ mb: 0.5, letterSpacing: 0.2, color: 'var(--color-white)' }}>New subject</Typography>
        <Typography variant="body2" sx={{ mb: 2, color: 'color-mix(in srgb, var(--color-white) 66%, transparent)' }}>
          Create a study subject to open its kanban board. You can attach your documents, videos, books and lectures as study-material cards to track progress.
        </Typography>

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

  const columnCount = (topic) =>
    (topic?.board?.columns || []).map((c) => ({ title: c.title, count: (c.cards || []).length }));

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', background: 'var(--color-navy-deep)', p: { xs: 3, md: 6, lg: 7 }, color: 'var(--color-white)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: 0.3, mb: 0.5 }}>Subjects</Typography>
          <Typography variant="body1" sx={{ color: 'color-mix(in srgb, var(--color-white) 66%, transparent)', maxWidth: 560 }}>
            Organize your study around subjects. Each subject has a kanban board where you attach your documents, videos, books and lectures as study-material cards to track progress.
          </Typography>
        </Box>
        <Button
          variant="contained" onClick={() => setOpen(true)} startIcon={<AddIcon />}
          sx={{ borderRadius: '999px', px: 3, py: 1.1, background: 'var(--color-teal)', color: 'var(--color-navy-deep)', fontWeight: 700, textTransform: 'none', boxShadow: '0 10px 28px color-mix(in srgb, var(--color-teal) 30%, transparent)', '&:hover': { background: 'var(--color-teal-pale)' } }}
        >
          New subject
        </Button>
      </Box>

      {error && <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: 'color-mix(in srgb, var(--color-danger-soft) 14%, transparent)' }}>{error}</Box>}

      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 12 }}><CircularProgress sx={{ color: 'var(--color-teal)' }} /></Box>
      ) : topics.length === 0 ? (
        <Box sx={{ mt: 6, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 3 }}>
          {[0, 1, 2].map((i) => (
            <button key={i} onClick={() => setOpen(true)} style={{ cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }}>
              <Box sx={{ p: 3, borderRadius: 4, border: '1.5px dashed color-mix(in srgb, var(--color-white) 20%, transparent)', minHeight: 170, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', '&:hover': { borderColor: 'var(--color-teal)' } }}>
                <AddIcon sx={{ fontSize: 40, color: 'color-mix(in srgb, var(--color-white) 40%, transparent)', mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>New subject</Typography>
                <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)' }}>
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
                cursor: 'pointer', borderRadius: 4, overflow: 'hidden', bgcolor: 'color-mix(in srgb, var(--color-navy-700) 70%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-white) 12%, transparent)',
                transition: 'transform .2s, border .2s',
                '&:hover': { transform: 'translateY(-3px)', borderColor: 'color-mix(in srgb, var(--color-teal) 55%, transparent)' },
              }}
            >
              <Box sx={{ height: 6, bgcolor: t.color || 'var(--color-teal)' }} />
              <Box sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, background: `color-mix(in srgb, ${t.color || '#14B8A6'} 18%, transparent)` }}>{t.emoji || '🧠'}</Box>
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
          <Box onClick={() => setOpen(true)} sx={{ cursor: 'pointer', p: 3, borderRadius: 4, border: '1.5px dashed color-mix(in srgb, var(--color-white) 20%, transparent)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: 'none', '&:hover': { borderColor: 'var(--color-teal)' } }}>
            <AddIcon sx={{ fontSize: 40, color: 'color-mix(in srgb, var(--color-white) 40%, transparent)' }} />
            <Typography sx={{ fontWeight: 700 }}>New subject</Typography>
          </Box>
        </Box>
      )}

      {open && <NewSubjectDialog open onClose={() => setOpen(false)} onCreated={() => { setOpen(false); fetchTopics(); }} />}
    </Box>
  );
};

export default Subjects;