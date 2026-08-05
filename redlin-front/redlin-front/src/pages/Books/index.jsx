import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import AddIcon from '@mui/icons-material/Add';
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

  return (
    <Box sx={{ width: '100%', p: { xs: 3, md: 4 }, height: '100%', overflowY: 'auto', background: 'var(--color-navy-deep)' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 3.5 }}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 0.95, mb: '14px', maxWidth: '14ch', color: 'var(--color-white)' }}>Books</Typography>
          <Typography variant="body1" sx={{ maxWidth: '56ch', color: 'color-mix(in srgb, var(--color-white) 74%, transparent)' }}>
            Upload long PDFs as books, split them into chapter ranges, and study each chapter with its own summary, quiz, cloze, and Feynman practice.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/books/new')}
          sx={{
            borderRadius: '999px',
            px: 3,
            py: 1.15,
            fontWeight: 700,
            textTransform: 'none',
            flexShrink: 0,
            backgroundColor: 'var(--color-teal)',
            color: 'var(--color-navy-deep)',
            boxShadow: '0 10px 28px color-mix(in srgb, var(--color-teal) 30%, transparent)',
            '&:hover': { backgroundColor: 'var(--color-teal-pale)' },
          }}
        >
          Add book
        </Button>
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
        {books.map((book) => {
          const chapters = book.chapters || [];
          const done = chapters.filter((c) => c.processing_status === 'completed').length;
          const pending = chapters.length - done;
          const preview = chapters.slice(0, 3);
          return (
            <Box
              key={book.id}
              onClick={() => navigate(`/books/${book.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/books/${book.id}`); } }}
              sx={{
                cursor: 'pointer',
                borderRadius: '20px',
                background: 'color-mix(in srgb, var(--color-navy-700) 70%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform .2s cubic-bezier(.2,.8,.2,1), border-color .2s, box-shadow .2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  borderColor: 'color-mix(in srgb, var(--color-teal) 55%, transparent)',
                  boxShadow: '0 18px 44px color-mix(in srgb, var(--color-black) 42%, transparent)',
                },
                '&:focus-visible': { outline: '2px solid var(--color-teal)', outlineOffset: '2px' },
              }}
            >
              {/* Cover — real first page of the PDF over a black fallback background */}
              <Box
                sx={{
                  position: 'relative',
                  height: 132,
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
              </Box>

              {/* Body */}
              <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
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

                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)' }}>Study progress</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={chapters.length ? (done / chapters.length) * 100 : 0}
                    sx={{
                      height: 4,
                      borderRadius: 999,
                      backgroundColor: 'color-mix(in srgb, var(--color-white) 10%, transparent)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 999,
                        background: 'linear-gradient(90deg, var(--color-teal), var(--color-purple))',
                      },
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
        {!loading && !error && Array.from({ length: Math.max(0, 8 - books.length) }).map((_, i) => (
          <Box
            key={`book-slot-${i}`}
            role="button"
            tabIndex={0}
            onClick={() => navigate('/books/new')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/books/new'); } }}
            sx={{
              cursor: 'pointer',
              borderRadius: '20px',
              border: '1px dashed color-mix(in srgb, var(--color-white) 20%, transparent)',
              background: 'color-mix(in srgb, var(--color-navy-700) 30%, transparent)',
              minHeight: 280,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              p: 4,
              gap: 1.5,
              transition: 'transform .2s cubic-bezier(.2,.8,.2,1), border-color .2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                borderColor: 'color-mix(in srgb, var(--color-teal) 55%, transparent)',
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
                border: '1px dashed color-mix(in srgb, var(--color-white) 22%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 0.5,
              }}
            >
              <AddIcon sx={{ fontSize: 26, color: 'color-mix(in srgb, var(--color-white) 32%, transparent)' }} />
            </Box>
            <Box>
              <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 74%, transparent)', fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>
                Add a book to this space
              </Typography>
              <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 48%, transparent)', fontSize: 13, lineHeight: 1.55, mt: 0.6, maxWidth: 224, mx: 'auto' }}>
                Upload a long PDF and split it into chapter ranges — each one becomes its own study space.
              </Typography>
            </Box>
          </Box>
        ))}
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
