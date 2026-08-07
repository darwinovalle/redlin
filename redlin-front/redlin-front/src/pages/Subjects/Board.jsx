import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { topicsService } from '../../services/api/topics';
import { documentService } from '../../services/api';
import { videoService } from '../../services/api/video';
import { classroomService } from '../../services/api/classroom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';

// Fetch the user's existing study material (unchanged sections) so a card can
// attach any of them via the generic CardResource link.
function useResourceLibrary(userId) {
  const [docs, setDocs] = useState([]);
  const [videos, setVideos] = useState([]);
  const [sessions, setSessions] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const d = userId ? await documentService.getUserDocuments(userId) : [];
        setDocs(Array.isArray(d) ? d : []);
      } catch { setDocs([]); }
      try {
        const v = await videoService.listVideos();
        setVideos(Array.isArray(v) ? v : []);
      } catch { setVideos([]); }
      try {
        const s = await classroomService.listSessions();
        setSessions(Array.isArray(s) ? s : []);
      } catch { setSessions([]); }
    })();
  }, [userId]);
  return { docs, videos, sessions };
}

const Board = () => {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openCard, setOpenCard] = useState(false);
  const [openCol, setOpenCol] = useState(false);
  const [cardCol, setCardCol] = useState(null);
  const lib = useResourceLibrary(user?.id);

  const loadTopic = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const t = await topicsService.getTopic(topicId);
      setTopic(t);
    } catch (e) {
      setError(e?.message || 'Could not load this subject.');
    } finally { setLoading(false); }
  }, [topicId]);

  useEffect(() => { if (topicId) loadTopic(); }, [topicId, loadTopic]);

  const columns = useMemo(() => topic?.board?.columns || [], [topic]);

  const moveCard = async (cardId, toColumnId) => {
    const fromCol = columns.find((c) => (c.cards || []).some((k) => k.id === cardId));
    if (!fromCol || fromCol.id === toColumnId) return;
    const card = fromCol.cards.find((k) => k.id === cardId);
    // Optimistic local move, then persist + reconcile.
    setTopic((t) => t ? {
      ...t,
      board: {
        ...t.board,
        columns: t.board.columns.map((col) => {
          if (col.id === fromCol.id) return { ...col, cards: (col.cards || []).filter((k) => k.id !== cardId) };
          if (col.id === toColumnId) return { ...col, cards: [...(col.cards || []), { ...card, column: toColumnId }] };
          return col;
        }),
      },
    } : t);
    try { await topicsService.updateCard(cardId, { column: toColumnId }); }
    finally { loadTopic(); }
  };

  const addCreateCard = async (title, resType, resId) => {
    setOpenCard(false);
    try {
      const card = await topicsService.createCard({ column: cardCol, title });
      if (resType && resId) {
        try { await topicsService.addResource(card.id, resType, resId); } catch { /* resource attach optional */ }
      }
    } catch (e) { window.alert(e?.response?.data?.detail || 'Failed to add card'); }
    await loadTopic();
  };

  const addColumn = async (title) => {
    setOpenCol(false);
    try { await topicsService.createColumn({ board: topic?.board?.id, title }); }
    catch (e) { window.alert(e?.response?.data?.detail || 'Failed to add column'); }
    await loadTopic();
  };

  const deleteColumn = async (col) => {
    if (!window.confirm(`Delete column "${col.title}"? Its cards are removed too.`)) return;
    await topicsService.deleteColumn(col.id);
    await loadTopic();
  };

  const deleteCard = async (card) => {
    if (!window.confirm(`Delete card "${card.title}"?`)) return;
    await topicsService.deleteCard(card.id);
    await loadTopic();
  };

  if (loading) return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress sx={{ color: 'var(--color-teal)' }} /></Box>;
  if (!topic) return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'color-mix(in srgb, var(--color-white) 55%, transparent)' }}>{error || 'Subject not found'}</Box>;

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', background: 'var(--color-navy-deep)', p: { xs: 3, md: 5 }, color: 'var(--color-white)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <IconButton onClick={() => navigate('/subjects')} aria-label="Back to subjects" sx={{ color: 'var(--color-white)' }}><ArrowBackIcon /></IconButton>
        <Box sx={{ width: 40, height: 40, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: `color-mix(in srgb, ${topic.color || '#14B8A6'} 20%, transparent)` }}>{topic.emoji || '🧠'}</Box>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>{topic.name}</Typography>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', gap: 2, overflowX: 'auto', pb: 2, alignItems: 'flex-start' }}>
        {columns.map((col) => (
          <ColumnShell
            key={col.id}
            col={col}
            onDropCard={(cardId) => moveCard(cardId, col.id)}
            onAddCard={() => { setCardCol(col.id); setOpenCard(true); }}
            onDeleteColumn={() => deleteColumn(col)}
            onDeleteCard={deleteCard}
          />
        ))}
        <Box onClick={() => setOpenCol(true)} role="button" tabIndex={0} sx={{ flexShrink: 0, width: 260, borderRadius: 3, border: '1.5px dashed color-mix(in srgb, var(--color-white) 22%, transparent)', minHeight: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: 'pointer', '&:hover': { borderColor: 'var(--color-teal)' } }}>
          <AddIcon sx={{ fontSize: 34, color: 'color-mix(in srgb, var(--color-white) 50%, transparent)' }} />
          <Typography sx={{ fontWeight: 600 }}>Add column</Typography>
        </Box>
      </Box>

      {openCard && (
        <NewCardDialog
          open
          library={lib}
          onClose={() => setOpenCard(false)}
          onSubmit={addCreateCard}
        />
      )}
      {openCol && <ColumnNameDialog open onClose={() => setOpenCol(false)} onSubmit={addColumn} />}
    </Box>
  );
};

const ColumnShell = ({ col, onDropCard, onAddCard, onDeleteColumn, onDeleteCard }) => {
  const [over, setOver] = useState(false);
  return (
    <Box
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData('text/card'); if (id) onDropCard(id); }}
      sx={{
        flexShrink: 0, width: 280, borderRadius: 3, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 180px)', overflow: 'hidden',
        bgcolor: over ? 'color-mix(in srgb, var(--color-teal) 12%, transparent)' : 'color-mix(in srgb, var(--color-navy-700) 55%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-white) 12%, transparent)', transition: 'background .15s',
      }}
    >
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontWeight: 700, flex: 1, fontSize: 15 }}>{col.title}</Typography>
        <Chip size="small" label={(col.cards || []).length} sx={{ color: 'var(--color-white)', bgcolor: 'color-mix(in srgb, var(--color-white) 12%, transparent)', fontSize: 12 }} />
        <IconButton size="small" aria-label="Add card" onClick={onAddCard} sx={{ color: 'var(--color-teal)' }}><AddIcon fontSize="small" /></IconButton>
        <IconButton size="small" aria-label="Delete column" onClick={onDeleteColumn} sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)' }}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ px: 1.5, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', flex: 1 }}>
        {(col.cards || []).map((card) => (
          <CardShell key={card.id} card={card} onDelete={() => onDeleteCard(card)} />
        ))}
        {(col.cards || []).length === 0 && (
          <Typography sx={{ px: 1, py: 2, textAlign: 'center', fontSize: 13, fontStyle: 'italic', color: 'color-mix(in srgb, var(--color-white) 45%, transparent)' }}>Drop study material here</Typography>
        )}
      </Box>
    </Box>
  );
};

const CardShell = ({ card, onDelete }) => (
  <Box
    draggable
    onDragStart={(e) => { e.dataTransfer.setData('text/card', String(card.id)); e.dataTransfer.effectAllowed = 'move'; }}
    sx={{
      p: 1.5, borderRadius: 2, bgcolor: 'color-mix(in srgb, var(--color-navy-700) 70%, transparent)',
      border: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)', cursor: 'grab',
      transition: 'transform .1s', '&:active': { cursor: 'grabbing' },
      '&:hover': { borderColor: 'color-mix(in srgb, var(--color-teal) 45%, transparent)' },
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
      <Typography sx={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>{card.title}</Typography>
      <IconButton size="small" aria-label="Delete card" onClick={onDelete} sx={{ p: 0.25, color: 'color-mix(in srgb, var(--color-white) 55%, transparent)', '&:hover': { color: 'var(--color-danger-soft)' } }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
    {(card.resources || []).length > 0 && (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
        {(card.resources || []).map((r) => (
          <Chip key={`${r.content_type}-${r.object_id}`} size="small" label={r.resource?.title || 'material'} sx={{ fontSize: 11, bgcolor: 'color-mix(in srgb, var(--color-teal) 16%, transparent)', color: 'var(--color-white)' }} />
        ))}
      </Box>
    )}
  </Box>
);

const NewCardDialog = ({ open, onClose, library, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [resKey, setResKey] = useState('');
  const groups = useMemo(() => {
    const g = [
      { key: 'document', label: 'Documents', items: library.docs.filter((d) => d.kind !== 'book') },
      { key: 'document', label: 'Books', items: library.docs.filter((d) => d.kind === 'book') },
      { key: 'video', label: 'Videos', items: library.videos },
      { key: 'lecture', label: 'Lectures', items: library.sessions },
    ];
    return g.filter((x) => x.items.length > 0);
  }, [library]);

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ style: { backgroundColor: '#1A2A3A' }, sx: { width: { xs: '92vw', sm: 460 }, maxWidth: '92vw', borderRadius: '18px', p: 3, boxShadow: '0 24px 80px rgba(0,0,0,0.5)' } }}>
      <Typography variant="h6" sx={{ color: 'var(--color-white)', fontWeight: 700, mb: 2 }}>Add study material card</Typography>
      <TextField
        fullWidth autoFocus label="Task / card title" value={title} onChange={(e) => setTitle(e.target.value)}
        inputProps={{ maxLength: 120 }}
        sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: 'var(--color-white)', '& fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 14%, transparent)' }, '&.Mui-focused fieldset': { borderColor: 'var(--color-teal)' } }, '& .MuiInputLabel-root': { color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' } }}
      />
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>Attach study material (optional)</InputLabel>
        <Select value={resKey} onChange={(e) => setResKey(e.target.value)} label="Attach study material (optional)" sx={{ color: 'var(--color-white)' }}>
          <MenuItem value=""><em>None</em></MenuItem>
          {groups.flatMap((g, gi) => [
            <MenuItem key={`h-${gi}`} disabled sx={{ color: 'var(--color-teal)', fontWeight: 700, fontSize: 12 }}>{g.label}</MenuItem>,
            ...g.items.map((it) => (
              <MenuItem key={`${g.key}-${it.id}`} value={`${g.key}:${it.id}`}>{it.title || it.filename || it.video_id || `Item ${it.id}`}</MenuItem>
            )),
          ])}
        </Select>
      </FormControl>
      <Button variant="contained" fullWidth disabled={!title.trim()} onClick={() => { const [rt, rid] = (resKey || ':').split(':'); onSubmit(title.trim(), rt || null, rid ? Number(rid) : null); }} sx={{ borderRadius: '999px', py: 1.1, background: 'var(--color-teal)', color: 'var(--color-navy-deep)', fontWeight: 700, textTransform: 'none', '&:hover': { background: 'var(--color-teal-pale)' } }}>Add card</Button>
    </Dialog>
  );
};

const ColumnNameDialog = ({ open, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ style: { backgroundColor: '#1A2A3A' }, sx: { width: { xs: '92vw', sm: 380 }, maxWidth: '92vw', borderRadius: '18px', p: 3, boxShadow: '0 24px 80px rgba(0,0,0,0.5)' } }}>
      <Typography variant="h6" sx={{ color: 'var(--color-white)', fontWeight: 700, mb: 2 }}>New column</Typography>
      <TextField fullWidth autoFocus label="Column title" value={name} onChange={(e) => setName(e.target.value)} sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: 'var(--color-white)', '& fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 14%, transparent)' }, '&.Mui-focused fieldset': { borderColor: 'var(--color-teal)' } }, '& .MuiInputLabel-root': { color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' } }} />
      <Button fullWidth variant="contained" disabled={!name.trim()} onClick={() => onSubmit(name.trim())} sx={{ borderRadius: '999px', py: 1.1, background: 'var(--color-teal)', color: 'var(--color-navy-deep)', fontWeight: 700, textTransform: 'none', '&:hover': { background: 'var(--color-teal-pale)' } }}>Add column</Button>
    </Dialog>
  );
};

export default Board;