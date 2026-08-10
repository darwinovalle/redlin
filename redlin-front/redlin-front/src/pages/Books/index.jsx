import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CheckIcon from '@mui/icons-material/Check';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { documentService } from '../../services/api';
import PdfCover from './PdfCover';
import ItemMenu from '../../components/common/ItemMenu';
import RenameDialog from '../../components/common/RenameDialog';
import ConfirmDialog from '../../components/common/ConfirmDialog';

const STATUS_COLOR = {
  completed: 'var(--color-success)',
  processing: 'var(--color-teal)',
  failed: 'var(--color-danger-soft)',
};

const Books = () => {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [renameState, setRenameState] = useState({ open: false, book: null, saving: false });
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null, confirming: false });

  // Reusable confirm + rename dialogs (same pattern as the sidebar).
  const openConfirm = ({ title, message, onConfirm }) => setConfirmState({ open: true, title, message, onConfirm, confirming: false });
  const closeConfirm = () => setConfirmState({ open: false, title: '', message: '', onConfirm: null, confirming: false });
  const runConfirm = async () => {
    if (!confirmState.onConfirm) return;
    try {
      setConfirmState((s) => ({ ...s, confirming: true }));
      await confirmState.onConfirm();
      closeConfirm();
    } catch {
      closeConfirm();
      alert('Failed to delete');
    }
  };
  const openRename = (book) => setRenameState({ open: true, book, saving: false });
  const closeRename = () => setRenameState({ open: false, book: null, saving: false });
  const submitRename = async (newTitle) => {
    if (!renameState.book) return;
    try {
      setRenameState((s) => ({ ...s, saving: true }));
      await documentService.renameDocument(renameState.book.id, newTitle.trim());
      setBooks((d) => d.map((x) => (x.id === renameState.book.id ? { ...x, title: newTitle.trim() } : x)));
      closeRename();
    } catch (e) {
      setError(e?.error || 'Rename failed');
      setRenameState((s) => ({ ...s, saving: false }));
    }
  };
  const handleDeleteBook = (book) => openConfirm({
    title: 'Delete book?',
    message: `Are you sure you want to delete "${book.title}"? This will also remove all of its chapters. This cannot be undone.`,
    onConfirm: async () => {
      await documentService.deleteDocument(book.id);
      setBooks((d) => d.filter((x) => x.id !== book.id));
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBooks(await documentService.listBooks());
    } catch (e) {
      setError(e?.detail || e?.message || 'Could not load books');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Title filter
  const [query, setQuery] = useState('');
  const visible = query.trim()
    ? books.filter((b) => (b.title || '').toLowerCase().includes(query.trim().toLowerCase()))
    : books;

  // Multi-select + batch delete
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const toggleSelect = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const clearSelection = () => { setSelectedIds(new Set()); setSelectMode(false); };
  const handleDeleteSelected = () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    openConfirm({
      title: ids.length === 1 ? 'Delete book?' : `Delete ${ids.length} books?`,
      message: `Delete ${ids.length} selected book${ids.length === 1 ? '' : 's'}? This cannot be undone.`,
      onConfirm: async () => {
        for (const id of ids) { try { await documentService.deleteDocument(id); } catch {} }
        clearSelection();
        await load();
      },
    });
  };

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', overflowX: 'hidden', background: 'radial-gradient(circle, color-mix(in srgb, var(--color-navy) 30%, transparent) 1px, transparent 1.5px), #FFFFFF', backgroundSize: '22px 22px' }}>
      {/* Hero — full-width navy panel with decorative glow bubbles */}
      <Box sx={{ position: 'relative', width: '100%', mb: { xs: 4, md: 6 }, overflow: 'hidden', background: 'var(--color-navy-deep)' }}>
        <Box sx={{ position: 'absolute', top: -80, right: -40, width: 288, height: 288, borderRadius: '50%', background: 'radial-gradient(circle, rgba(127, 99, 244, 0.35), transparent 70%)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', bottom: -96, left: '33.33%', width: 288, height: 288, borderRadius: '50%', background: 'radial-gradient(circle, rgba(32, 201, 151, 0.3), transparent 70%)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'relative', maxWidth: 1500, mx: 'auto', px: { xs: '24px', md: '40px' }, py: { xs: '48px', md: '64px' } }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-teal)', mb: 2 }}>
            Book library
          </Box>
          <Typography component="h1" sx={{ fontFamily: "'Poppins', 'Titillium Web', sans-serif", fontWeight: 700, lineHeight: 1.1, fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', color: 'var(--color-white)' }}>
            Books
          </Typography>
          <Typography sx={{ color: '#B0B7C3', mt: 1.5, maxWidth: 672, fontSize: 15, lineHeight: 1.6 }}>
            Upload long PDFs as books, split them into chapter ranges, and study each chapter with its own summary, quiz, cloze, and Feynman practice.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/books/new')} sx={{ mt: 3.5, height: 48, px: 3, borderRadius: '999px', backgroundColor: 'var(--color-teal)', color: 'var(--color-white)', fontWeight: 600, fontSize: 14, textTransform: 'none', boxShadow: '0 6px 20px rgba(32, 201, 151, 0.5)', transition: 'all .2s ease', '&:hover': { backgroundColor: 'var(--color-teal-hover)', transform: 'translateY(-2px)' } }}>
            Add book
          </Button>
        </Box>
      </Box>

      <Box sx={{ p: { xs: 3, md: 4 }, pt: 0 }}>
      {/* Search + selection toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3.5, flexWrap: 'wrap', maxWidth: { xs: '100%', md: 780 } }}>
        <Box sx={{ flex: 1, minWidth: 260, height: 46, display: 'flex', alignItems: 'center', gap: 1.5, px: 2, borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--color-white) 16%, transparent)', background: 'linear-gradient(135deg, var(--color-navy-050) 0%, var(--color-navy-200) 48%, var(--color-navy) 100%)', boxShadow: '0 6px 18px color-mix(in srgb, var(--color-navy) 10%, transparent)', transition: 'border-color .2s, box-shadow .2s', '&:focus-within': { borderColor: 'var(--color-teal)', boxShadow: '0 6px 22px color-mix(in srgb, var(--color-teal) 22%, transparent)' } }}>
          <SearchRoundedIcon sx={{ color: 'color-mix(in srgb, var(--color-white) 70%, transparent)', fontSize: 19 }} />
          <input
            className="study-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search books by title…"
            aria-label="Search books"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--color-white)', fontFamily: 'inherit' }}
          />
          {query && (
            <IconButton size="small" aria-label="Clear search" onClick={() => setQuery('')} sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)', '&:hover': { color: 'var(--color-white)' } }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {!selectMode ? (
          <Button aria-label="Select books" onClick={() => setSelectMode(true)} sx={{ flexShrink: 0, height: 46, px: 3, borderRadius: '12px', background: 'var(--color-teal)', color: 'var(--color-navy-deep)', textTransform: 'none', fontWeight: 700, fontSize: 14, letterSpacing: '0.01em', boxShadow: '0 8px 22px color-mix(in srgb, var(--color-teal) 34%, transparent)', '&:hover': { background: 'var(--color-teal-pale)' } }}>
            Select
          </Button>
        ) : (
          <>
            <Box sx={{ flexShrink: 0, height: 46, px: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, borderRadius: '12px', background: 'color-mix(in srgb, var(--color-navy) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-navy) 14%, transparent)' }}>
              <Typography sx={{ fontSize: 13, color: 'var(--color-text-mid)', fontWeight: 600 }}>{selectedIds.size}</Typography>
              <Typography sx={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 700 }}>selected</Typography>
            </Box>
            <Button onClick={handleDeleteSelected} disabled={selectedIds.size === 0} startIcon={<DeleteOutlineIcon />} sx={{ flexShrink: 0, height: 46, px: 3, borderRadius: '12px', background: 'var(--color-danger)', color: 'var(--color-white)', textTransform: 'none', fontWeight: 600, fontSize: 14, boxShadow: '0 8px 20px color-mix(in srgb, var(--color-danger) 28%, transparent)', '&:hover': { background: 'var(--color-danger-deep)' }, '&.Mui-disabled': { bgcolor: 'color-mix(in srgb, var(--color-white) 12%, transparent)', color: 'color-mix(in srgb, var(--color-white) 40%, transparent)', boxShadow: 'none' } }}>
              Delete
            </Button>
            <Button onClick={clearSelection} startIcon={<CloseIcon />} sx={{ flexShrink: 0, height: 46, px: 3, borderRadius: '12px', background: 'var(--color-white)', border: '1px solid color-mix(in srgb, var(--color-navy) 30%, transparent)', color: 'var(--color-navy-deep)', textTransform: 'none', fontWeight: 600, fontSize: 14, '&:hover': { borderColor: 'var(--color-navy)', boxShadow: '0 4px 14px color-mix(in srgb, var(--color-navy) 10%, transparent)' } }}>
              Cancel
            </Button>
          </>
        )}
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress sx={{ color: 'var(--color-teal)' }} />
        </Box>
      )}
      {error && (
        <Typography sx={{ color: 'var(--color-danger-soft)' }}>{String(error)}</Typography>
      )}

      {/* Elevated card grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 3 }}>
        {visible.map((book) => {
          const chapters = book.chapters || [];
          const done = chapters.filter((c) => c.processing_status === 'completed').length;
          const pending = chapters.length - done;
          const preview = chapters.slice(0, 3);
          return (
            <Box
              key={book.id}
              onClick={() => (selectMode ? toggleSelect(book.id) : navigate(`/books/${book.id}`))}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (selectMode) toggleSelect(book.id); else navigate(`/books/${book.id}`); } }}
              sx={{
                cursor: 'pointer',
                borderRadius: '20px',
                height: 360,
                position: 'relative',
                background: 'linear-gradient(135deg, var(--color-navy-050) 0%, var(--color-navy-200) 48%, var(--color-navy) 100%)',
                border: selectMode && selectedIds.has(book.id) ? '1px solid var(--color-teal)' : '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)',
                boxShadow: selectMode && selectedIds.has(book.id) ? '0 0 0 3px color-mix(in srgb, var(--color-teal) 35%, transparent)' : undefined,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform .2s cubic-bezier(.2,.8,.2,1), border-color .2s, box-shadow .2s',
                '&::before': { content: '""', position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%', background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-white) 16%, transparent), transparent)', transform: 'skewX(-15deg)', transition: 'left .6s ease', zIndex: 2, pointerEvents: 'none' },
                '&:hover': {
                  transform: 'translateY(-4px)',
                  borderColor: 'color-mix(in srgb, var(--color-teal) 55%, transparent)',
                  boxShadow: '0 18px 44px color-mix(in srgb, var(--color-black) 42%, transparent)',
                },
                '&:hover::before': { left: '140%' },
                '&:focus-visible': { outline: '2px solid var(--color-teal)', outlineOffset: '2px' },
              }}
            >
              {/* Cover — real first page of the PDF over a black fallback background */}
              <Box
                sx={{
                  position: 'relative',
                  flex: '0 0 55%',
                  minHeight: 0,
                  background: '#000',
                  overflow: 'hidden',
                }}
              >
                {/* Renders the book's own cover page (backend thumbnail); falls back to the title on black */}
                <PdfCover url={documentService.getBookCoverUrl(book.id)} fallbackTitle={book.title} />
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0, top: 0, bottom: 0,
                    width: 7,
                    zIndex: 1,
                    background: 'linear-gradient(180deg, color-mix(in srgb, var(--color-black) 26%, transparent), color-mix(in srgb, var(--color-black) 10%, transparent))',
                  }}
                />
                <Box
                  sx={{ position: 'absolute', inset: 0, zIndex: 1, boxShadow: 'inset 0 -40px 60px color-mix(in srgb, var(--color-black) 22%, transparent)' }}
                />
                {selectMode && (
                  <Box onClick={(e) => { e.stopPropagation(); toggleSelect(book.id); }} sx={{ position: 'absolute', top: 12, left: 12, zIndex: 3, width: 26, height: 26, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: selectedIds.has(book.id) ? 'var(--color-teal)' : 'rgba(0,0,0,0.45)', color: selectedIds.has(book.id) ? 'var(--color-navy-deep)' : 'var(--color-white)', border: selectedIds.has(book.id) ? '2px solid transparent' : '2px solid color-mix(in srgb, var(--color-white) 55%, transparent)' }}>
                    {selectedIds.has(book.id) ? <CheckIcon sx={{ fontSize: 18 }} /> : null}
                  </Box>
                )}
              </Box>

              {/* Body */}
              <Box sx={{ flex: 1, minHeight: 0, p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.25, justifyContent: 'flex-start', background: 'linear-gradient(135deg, #1A5C4E 0%, #10443A 50%, #0A2F2A 100%)' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      fontWeight: 700,
                      lineHeight: 1.12,
                      color: 'var(--color-white)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {book.title}
                  </Typography>
                  <ItemMenu onRename={() => openRename(book)} onDelete={() => handleDeleteBook(book)} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 62%, transparent)', fontWeight: 600 }}>
                    {chapters.length} chapter{chapters.length === 1 ? '' : 's'}{book.total_pages ? ` · ${book.total_pages} pages` : ''}
                  </Typography>
                  <Chip
                    size="small"
                    label={done === chapters.length ? 'Ready' : `${done}/${chapters.length} ready`}
                    sx={{
                      height: 22,
                      fontWeight: 700,
                      color: 'var(--color-white)',
                      bgcolor: 'color-mix(in srgb, var(--color-success) 18%, transparent)',
                    }}
                  />
                </Box>

                {preview.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {preview.map((ch) => (
                      <Chip
                        key={ch.id}
                        size="small"
                        label={ch.title}
                        title={ch.title}
                        sx={{
                          maxWidth: 150,
                          height: 24,
                          fontSize: 11.5,
                          color: 'var(--color-white)',
                          bgcolor: 'color-mix(in srgb, var(--color-white) 8%, transparent)',
                          '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                        }}
                      />
                    ))}
                    {pending > 0 && (
                      <Chip
                        size="small"
                        label={`+${pending} pending`}
                        sx={{ height: 24, fontSize: 11.5, color: 'color-mix(in srgb, var(--color-white) 55%, transparent)', bgcolor: 'transparent', border: '1px dashed color-mix(in srgb, var(--color-white) 20%, transparent)' }}
                      />
                    )}
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}

        {/* Dashed "coming soon" slots so a fresh library never looks empty.
            Each fills the same footprint as a real book card; they disappear
            one by one as the user adds books (up to 8 cards on screen). */}
        {!loading && !error && !query.trim() && Array.from({ length: Math.max(0, 8 - visible.length) }).map((_, i) => (
          <Box
            key={`book-slot-${i}`}
            role="button"
            tabIndex={0}
            onClick={() => navigate('/books/new')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/books/new'); } }}
            sx={{
              cursor: 'pointer',
              borderRadius: '20px',
              border: '2px dashed color-mix(in srgb, var(--color-navy) 45%, transparent)',
              background: 'var(--color-white)',
              minHeight: 320,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              p: 4,
              gap: 1.5,
              boxShadow: '0 6px 18px color-mix(in srgb, var(--color-navy) 7%, transparent)',
              transition: 'transform .2s cubic-bezier(.2,.8,.2,1), border-color .2s, box-shadow .2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                borderColor: 'color-mix(in srgb, var(--color-teal) 60%, transparent)',
                boxShadow: '0 14px 30px color-mix(in srgb, var(--color-navy) 16%, transparent)',
              },
              '&:focus-visible': { outline: '2px solid var(--color-teal)', outlineOffset: '2px' },
            }}
          >
            {/* Dashed "+" — the invitation to drop a book into this slot */}
            <Box
              sx={{
                width: 58,
                height: 58,
                borderRadius: '50%',
                border: '2px dashed color-mix(in srgb, var(--color-navy) 40%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 0.5,
              }}
            >
              <AddIcon sx={{ fontSize: 26, color: 'color-mix(in srgb, var(--color-navy) 55%, transparent)' }} />
            </Box>
            <Box>
              <Typography sx={{ color: 'var(--color-text)', fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>
                Add a book to this space
              </Typography>
              <Typography sx={{ color: 'var(--color-text-mid)', fontSize: 13, lineHeight: 1.55, mt: 0.6, maxWidth: 224, mx: 'auto' }}>
                Upload a long PDF and split it into chapter ranges — each one becomes its own study space.
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {!loading && !error && query.trim() && visible.length === 0 && (
        <Typography sx={{ textAlign: 'center', color: 'var(--color-text-mid)', py: 6 }}>
          No books match “{query}”.
        </Typography>
      )}
      </Box>

      <RenameDialog
        open={renameState.open}
        initialValue={renameState.book?.title || ''}
        onClose={closeRename}
        onSubmit={submitRename}
        submitting={renameState.saving}
        title="Rename book"
        label="Book title"
      />
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={runConfirm}
        onClose={closeConfirm}
        confirming={confirmState.confirming}
      />
    </Box>
  );
};

export default Books;
