import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { documentService } from '../../services/api';
import PdfViewer from '../../components/PdfViewer/PdfViewer';
import ItemMenu from '../../components/common/ItemMenu';
import RenameDialog from '../../components/common/RenameDialog';
import ConfirmDialog from '../../components/common/ConfirmDialog';

// Book detail: 50% chapter list / 50% book PDF, each pane scrolling on its own.
// Clicking a chapter opens its study panel (SUMMARY / MCQS / CLOZE / FEYNMAN),
// where the PDF shows only that chapter's page range. Chapters can be renamed,
// deleted, or extended with new ones via "Add chapters".
const BookDetail = () => {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [renameState, setRenameState] = useState({ open: false, chapter: null, saving: false });
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null, confirming: false });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const books = await documentService.listBooks();
      setBook(books.find((b) => String(b.id) === String(bookId)) || null);
      setChapters(await documentService.getBookChapters(bookId));
    } catch (e) {
      console.error('Load book failed:', e);
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => { load(); }, [load]);

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
  const openRename = (chapter) => setRenameState({ open: true, chapter, saving: false });
  const closeRename = () => setRenameState({ open: false, chapter: null, saving: false });
  const submitRename = async (newTitle) => {
    if (!renameState.chapter) return;
    try {
      setRenameState((s) => ({ ...s, saving: true }));
      await documentService.renameDocument(renameState.chapter.id, newTitle.trim());
      setChapters((d) => d.map((x) => (x.id === renameState.chapter.id ? { ...x, title: newTitle.trim() } : x)));
      closeRename();
    } catch (e) {
      console.error('Rename failed', e);
      setRenameState((s) => ({ ...s, saving: false }));
    }
  };
  const handleDeleteChapter = (chapter) => openConfirm({
    title: 'Delete chapter?',
    message: `Are you sure you want to delete "${chapter.title}"? Its study content will be removed too. This cannot be undone.`,
    onConfirm: async () => {
      await documentService.deleteDocument(chapter.id);
      setChapters((d) => d.filter((x) => x.id !== chapter.id));
    },
  });

  const pdfUrl = book ? documentService.getPdfUrl(book.id) : null;

  return (
    <Box sx={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-navy-deep)', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ px: 4, py: 2.5, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)' }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/books')}
          sx={{ color: 'color-mix(in srgb, var(--color-white) 70%, transparent)', textTransform: 'none', fontWeight: 600, flexShrink: 0, '&:hover': { color: 'var(--color-white)' } }}
        >
          Back to books
        </Button>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--color-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {book?.title || 'Book'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>
            {chapters.length} chapter{chapters.length === 1 ? '' : 's'} · full book PDF
          </Typography>
        </Box>
        <Button
          startIcon={<AddIcon />}
          onClick={() => navigate(`/books/new?bookId=${bookId}`)}
          sx={{
            ml: 'auto',
            flexShrink: 0,
            borderRadius: '999px',
            px: 3,
            py: 1,
            textTransform: 'none',
            fontWeight: 700,
            color: 'var(--color-teal)',
            border: '1px solid color-mix(in srgb, var(--color-teal) 45%, transparent)',
            '&:hover': { borderColor: 'var(--color-teal)', backgroundColor: 'color-mix(in srgb, var(--color-teal) 10%, transparent)' },
          }}
        >
          Add chapters
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress sx={{ color: 'var(--color-teal)' }} />
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {/* Left 50%: chapter list (dot-grid background) */}
          <Box
            sx={{
              width: '50%',
              flexShrink: 0,
              overflowY: 'auto',
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              borderRight: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)',
              backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--color-white) 12%, transparent) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          >
            {chapters.length === 0 ? (
              <Box sx={{ p: 6, textAlign: 'center', border: '1px dashed color-mix(in srgb, var(--color-white) 18%, transparent)', borderRadius: 4, background: 'color-mix(in srgb, var(--color-navy-deep) 60%, transparent)' }}>
                <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>This book has no chapters yet.</Typography>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => navigate(`/books/new?bookId=${bookId}`)}
                  sx={{ mt: 2, borderRadius: '999px', px: 3, textTransform: 'none', fontWeight: 700, color: 'var(--color-teal)', border: '1px solid color-mix(in srgb, var(--color-teal) 45%, transparent)', '&:hover': { borderColor: 'var(--color-teal)', backgroundColor: 'color-mix(in srgb, var(--color-teal) 10%, transparent)' } }}
                >
                  Add chapters
                </Button>
              </Box>
            ) : chapters.map((ch) => (
              <Box
                key={ch.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/books/${bookId}/chapters/${ch.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/books/${bookId}/chapters/${ch.id}`); } }}
                sx={{
                  cursor: 'pointer',
                  borderRadius: 3,
                  p: 2.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  background: 'color-mix(in srgb, var(--color-navy-800) 86%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)',
                  transition: 'border-color .2s, background .2s',
                  '&:hover': { borderColor: 'color-mix(in srgb, var(--color-teal) 45%, transparent)', background: 'color-mix(in srgb, var(--color-navy-800) 94%, transparent)' },
                  '&:focus-visible': { outline: '2px solid var(--color-teal)', outlineOffset: 2 },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', bgcolor: 'color-mix(in srgb, var(--color-teal) 16%, transparent)', color: 'var(--color-teal)', fontWeight: 700, flexShrink: 0 }}>
                  {chapters.findIndex((c) => c.id === ch.id) + 1}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'var(--color-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ch.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>
                    Pages {ch.page_start}–{ch.page_end || 'end'}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={ch.processing_status}
                  sx={{ color: 'var(--color-white)', bgcolor: 'color-mix(in srgb, var(--color-white) 10%, transparent)', textTransform: 'capitalize' }}
                />
                <ItemMenu onRename={() => openRename(ch)} onDelete={() => handleDeleteChapter(ch)} />
                <ChevronRightIcon sx={{ color: 'color-mix(in srgb, var(--color-white) 50%, transparent)' }} />
              </Box>
            ))}
          </Box>

          {/* Right 50%: book PDF with head + foot toolbar */}
          <Box sx={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
            {pdfUrl ? (
              <PdfViewer url={pdfUrl} />
            ) : (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>No document selected.</Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}

      <RenameDialog
        open={renameState.open}
        initialValue={renameState.chapter?.title || ''}
        onClose={closeRename}
        onSubmit={submitRename}
        submitting={renameState.saving}
        title="Rename chapter"
        label="Chapter title"
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

export default BookDetail;
