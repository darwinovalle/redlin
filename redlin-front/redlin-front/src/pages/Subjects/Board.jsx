import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { srService } from '../../services/api/sr';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { topicsService } from '../../services/api/topics';
import { documentService } from '../../services/api';
import { videoService } from '../../services/api/video';
import { classroomService } from '../../services/api/classroom';
import { DndContext, useDraggable, useDroppable, DragOverlay } from '@dnd-kit/core';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import MenuItem from '@mui/material/MenuItem';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import PauseCircleRoundedIcon from '@mui/icons-material/PauseCircleRounded';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';

// Fetch the user's existing study material from the unchanged sections
// (documents, books, videos, lectures) so a card can attach any of them.
function useResourceLibrary(userId) {
  const [docs, setDocs] = useState([]);
  const [books, setBooks] = useState([]);
  const [videos, setVideos] = useState([]);
  const [sessions, setSessions] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const d = userId ? await documentService.getUserDocuments(userId) : [];
        setDocs(Array.isArray(d) ? d : []);
      } catch { setDocs([]); }
      try {
        const b = await documentService.listBooks();
        setBooks(Array.isArray(b) ? b : []);
      } catch { setBooks([]); }
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
  return { docs, books, videos, sessions };
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
  const [activeCard, setActiveCard] = useState(null);
  // Study timer -> records time to the stats/SR engine on stop.
  const [ticking, setTicking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startAtRef = useRef(null);
  const lib = useResourceLibrary(user?.id);

  useEffect(() => {
    if (!ticking) return undefined;
    const id = window.setInterval(() => {
      setElapsed(Math.round((Date.now() - (startAtRef.current || Date.now())) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [ticking]);

  const toggleTimer = () => {
    if (ticking) {
      const s = Math.round((Date.now() - (startAtRef.current || Date.now())) / 1000);
      setTicking(false); setElapsed(0);
      if (s >= 3 && topic?.id) {
        srService.recordStudy({ seconds: s, topic: topic.id, method: 'STUDY' }).catch(() => {});
      }
    } else {
      startAtRef.current = Date.now();
      setElapsed(0);
      setTicking(true);
    }
  };

  // silent=true refreshes data without toggling the full-screen spinner, so a
  // drag/reload doesn't unmount the board (which was causing a white blink).
  const loadTopic = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const t = await topicsService.getTopic(topicId);
      setTopic(t);
    } catch (e) {
      if (!silent) setError(e?.message || 'Could not load this subject.');
    } finally {
      if (!silent) setLoading(false);
    }
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
    finally { loadTopic(true); }
  };

  const handleDragEnd = (e) => {
    if (!e.over) return;
    const cardId = Number(e.active.id);
    let toColumnId = Number(e.over.id);
    // Dropping onto a card should resolve to that card's column.
    if (!columns.some((c) => c.id === toColumnId)) {
      const overCard = columns.flatMap((c) => (c.cards || [])).find((k) => k.id === toColumnId);
      if (overCard) toColumnId = Number(overCard.column);
    }
    if (!columns.some((c) => c.id === toColumnId)) return;
    moveCard(cardId, toColumnId);
  };

  const handleDragStart = (e) => {
    const id = Number(e.active.id);
    const card = columns.flatMap((c) => (c.cards || [])).find((k) => k.id === id);
    setActiveCard(card || null);
  };

  const closeDrag = () => setActiveCard(null);

  const addCreateCard = async (title, resType, resId) => {
    setOpenCard(false);
    try {
      const card = await topicsService.createCard({ column: cardCol, title });
      try { await topicsService.addResource(card.id, resType, resId); }
      catch (e) { window.alert((e?.response?.data?.detail) || 'Could not attach the material to the card.'); }
    } catch (e) { window.alert(e?.response?.data?.detail || 'Failed to add card'); }
    await loadTopic(true);
  };

  const addColumn = async (title) => {
    setOpenCol(false);
    try { await topicsService.createColumn({ board: topic?.board?.id, title }); }
    catch (e) { window.alert(e?.response?.data?.detail || 'Failed to add column'); }
    await loadTopic(true);
  };

  const deleteColumn = async (col) => {
    if (!window.confirm(`Delete column "${col.title}"? Its cards are removed too.`)) return;
    await topicsService.deleteColumn(col.id);
    await loadTopic(true);
  };

  const deleteCard = async (card) => {
    if (!window.confirm(`Delete card "${card.title}"?`)) return;
    await topicsService.deleteCard(card.id);
    await loadTopic(true);
  };

  if (loading) return <Box sx={{ minHeight: '100vh', width: '100%', background: 'var(--color-navy-deep)', display: 'grid', placeItems: 'center' }}><CircularProgress sx={{ color: 'var(--color-teal)' }} /></Box>;
  if (!topic) return <Box sx={{ minHeight: '100vh', width: '100%', background: 'var(--color-navy-deep)', display: 'grid', placeItems: 'center', color: 'color-mix(in srgb, var(--color-white) 55%, transparent)' }}>{error || 'Subject not found'}</Box>;

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', background: 'var(--color-navy-deep)', p: { xs: 3, md: 5 }, color: 'var(--color-white)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <IconButton onClick={() => navigate('/subjects')} aria-label="Back to subjects" sx={{ color: 'var(--color-white)' }}><ArrowBackIcon /></IconButton>
        <Box sx={{ width: 40, height: 40, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: `color-mix(in srgb, ${topic.color || 'var(--color-teal)'} 20%, transparent)` }}>{topic.emoji || '🧠'}</Box>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>{topic.name}</Typography>
        <Chip size="small" label="drag cards between columns to change status" sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)', bgcolor: 'color-mix(in srgb, var(--color-white) 8%, transparent)', fontSize: 12 }} />
        <Button
          onClick={toggleTimer}
          startIcon={ticking ? <PauseCircleRoundedIcon /> : <PlayCircleRoundedIcon />}
          sx={{ ml: 'auto', borderRadius: '999px', px: 2.5, py: 0.8, color: 'var(--color-navy-deep)', bgcolor: 'var(--color-teal)', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: 'var(--color-teal-pale)' } }}
        >
          {ticking ? `Stop · ${Math.floor(elapsed / 60)}m ${(elapsed % 60).toString().padStart(2, '0')}s` : 'Start studying'}
        </Button>
      </Box>

      <DndContext onDragStart={handleDragStart} onDragEnd={(e) => { handleDragEnd(e); closeDrag(); }} onDragCancel={closeDrag}>
        <Box sx={{ flex: 1, display: 'flex', gap: 2, overflowX: 'auto', pb: 2, alignItems: 'flex-start' }}>
          {columns.map((col) => (
            <ColumnShell
              key={col.id}
              col={col}
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
        <DragOverlay dropAnimation={null}>{activeCard ? <OverlayCard card={activeCard} /> : null}</DragOverlay>
      </DndContext>

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

const ColumnShell = ({ col, onAddCard, onDeleteColumn, onDeleteCard }) => {
  const { setNodeRef, isOver } = useDroppable({ id: String(col.id) });
  return (
    <Box
      ref={setNodeRef}
      sx={{
        flexShrink: 0, width: 280, borderRadius: 3, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 180px)', overflow: 'hidden',
        bgcolor: isOver ? 'color-mix(in srgb, var(--color-teal) 12%, transparent)' : 'color-mix(in srgb, var(--color-navy-700) 55%, transparent)',
        border: isOver ? '1px solid color-mix(in srgb, var(--color-teal) 40%, transparent)' : '1px solid color-mix(in srgb, var(--color-white) 12%, transparent)',
        transition: 'background .15s, border .15s',
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
          <Draggable key={card.id} card={card} onDelete={() => onDeleteCard(card)} />
        ))}
        {(col.cards || []).length === 0 && (
          <Typography sx={{ px: 1, py: 2, textAlign: 'center', fontSize: 13, fontStyle: 'italic', color: 'color-mix(in srgb, var(--color-white) 45%, transparent)' }}>Drop study material here</Typography>
        )}
      </Box>
    </Box>
  );
};

const CardView = ({ card, onDelete }) => (
  <>
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
      <Typography sx={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>{card.title}</Typography>
      {onDelete && (
        <IconButton size="small" aria-label="Delete card" onPointerDown={(e) => e.stopPropagation()} onClick={onDelete} sx={{ p: 0.25, color: 'color-mix(in srgb, var(--color-white) 55%, transparent)', '&:hover': { color: 'var(--color-danger-soft)' } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
    {(card.resources || []).length > 0 && (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
        {(card.resources || []).map((r) => (
          <Chip key={`${r.content_type}-${r.object_id}`} size="small" label={r.resource?.title || 'material'} sx={{ fontSize: 11, bgcolor: 'color-mix(in srgb, var(--color-teal) 16%, transparent)', color: 'var(--color-white)' }} />
        ))}
      </Box>
    )}
  </>
);

// In-column card: draggable but NOT translated — the moving copy lives in the
// DragOverlay, so this card stays put and is never clipped by overflow:hidden.
const Draggable = ({ card, onDelete }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: String(card.id) });
  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      sx={{
        p: 1.5, borderRadius: 2, bgcolor: 'color-mix(in srgb, var(--color-navy-700) 70%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
        opacity: isDragging ? 0.3 : 1,
        '&:hover': { borderColor: 'color-mix(in srgb, var(--color-teal) 45%, transparent)' },
      }}
    >
      <CardView card={card} onDelete={onDelete} />
    </Box>
  );
};

// Floating copy shown while dragging — rendered on top, never clipped/overlapped.
const OverlayCard = ({ card }) => (
  <Box sx={{
    p: 1.5, borderRadius: 2, minWidth: 248, maxWidth: 248, cursor: 'grabbing',
    bgcolor: 'var(--color-navy-700)', boxShadow: '0 18px 40px rgba(0,0,0,0.45)',
    border: '1px solid color-mix(in srgb, var(--color-teal) 55%, transparent)',
  }}>
    <CardView card={card} />
  </Box>
);

const NewCardDialog = ({ open, onClose, library, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [resKey, setResKey] = useState('');
  const groups = useMemo(() => {
    const g = [
      { key: 'document', label: 'Documents', items: library.docs.filter((d) => d.kind === 'document') },
      { key: 'document', label: 'Books', items: library.books },
      { key: 'video', label: 'Videos', items: library.videos },
      { key: 'lecture', label: 'Lectures', items: library.sessions },
    ];
    return g.filter((x) => x.items.length > 0);
  }, [library]);

  const submit = () => {
    if (!title.trim() || !resKey) return;
    const [rt, rid] = resKey.split(':');
    onSubmit(title.trim(), rt, Number(rid));
  };

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ style: { backgroundColor: '#1A2A3A' }, sx: { width: { xs: '92vw', sm: 460 }, maxWidth: '92vw', borderRadius: '18px', p: 3, boxShadow: '0 24px 80px rgba(0,0,0,0.5)' } }}>
      <Typography variant="h6" sx={{ color: 'var(--color-white)', fontWeight: 700, mb: 1.5 }}>Add study material card</Typography>
      <TextField
        fullWidth autoFocus label="Task / card title" value={title} onChange={(e) => setTitle(e.target.value)}
        inputProps={{ maxLength: 120 }}
        sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: 'var(--color-white)', '& fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 14%, transparent)' }, '&.Mui-focused fieldset': { borderColor: 'var(--color-teal)' } }, '& .MuiInputLabel-root': { color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' } }}
      />

      {groups.length === 0 ? (
        <Typography variant="body2" sx={{ mb: 2, color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>
          You don't have any study material yet. Add a document, book, video or lecture first, then you can attach it here.
        </Typography>
      ) : (
        <>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>Attach study material</InputLabel>
            <Select value={resKey} onChange={(e) => setResKey(e.target.value)} label="Attach study material" sx={{ color: 'var(--color-white)' }}>
              {groups.flatMap((g, gi) => [
                <MenuItem key={`h-${gi}`} disabled sx={{ color: 'var(--color-teal)', fontWeight: 700, fontSize: 12 }}>{g.label}</MenuItem>,
                ...g.items.map((it) => (
                  <MenuItem key={`${g.key}-${it.id}`} value={`${g.key}:${it.id}`}>{it.title || it.filename || it.video_id || `Item ${it.id}`}</MenuItem>
                )),
              ])}
            </Select>
            <FormHelperText sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)' }}>Choose where this study material comes from.</FormHelperText>
          </FormControl>
          <Button variant="contained" fullWidth disabled={!title.trim() || !resKey} onClick={submit} sx={{ borderRadius: '999px', py: 1.1, background: 'var(--color-teal)', color: 'var(--color-navy-deep)', fontWeight: 700, textTransform: 'none', '&:hover': { background: 'var(--color-teal-pale)' } }}>Add card</Button>
        </>
      )}
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