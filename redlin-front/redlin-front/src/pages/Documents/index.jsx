import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import { documentService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import PdfCover from '../Books/PdfCover';
import ItemMenu from '../../components/common/ItemMenu';
import RenameDialog from '../../components/common/RenameDialog';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import DocumentImportModal from '../../components/common/DocumentImportModal';

const slugify = (str) =>
  (str || '')
    .toString()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const statusMeta = (status) => {
  if (status === 'completed') return { label: 'Ready', color: 'var(--color-success)' };
  if (status === 'failed') return { label: 'Failed', color: 'var(--color-danger-soft)' };
  return { label: 'Processing', color: 'var(--color-teal)' };
};

// Document directory: every study document as a card showing its PDF first page
// (fast backend thumbnail), click-through to its study session, rename/delete,
// and dashed placeholders — the same implementation as the Books grid.
const Documents = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState(null);
  const [renameState, setRenameState] = useState({ open: false, doc: null, saving: false });
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null, confirming: false });

  // Reusable confirm + rename dialogs (same pattern as Books / sidebar).
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
  const openRename = (doc) => setRenameState({ open: true, doc, saving: false });
  const closeRename = () => setRenameState({ open: false, doc: null, saving: false });
  const submitRename = async (newTitle) => {
    if (!renameState.doc) return;
    try {
      setRenameState((s) => ({ ...s, saving: true }));
      await documentService.renameDocument(renameState.doc.id, newTitle.trim());
      setDocuments((d) => d.map((x) => (x.id === renameState.doc.id ? { ...x, title: newTitle.trim() } : x)));
      closeRename();
    } catch (e) {
      setError(e?.error || 'Rename failed');
      setRenameState((s) => ({ ...s, saving: false }));
    }
  };
  const handleDeleteDocument = (doc) => openConfirm({
    title: 'Delete document?',
    message: `Are you sure you want to delete "${doc.title}"? Its study content will be removed too. This cannot be undone.`,
    onConfirm: async () => {
      await documentService.deleteDocument(doc.id);
      setDocuments((d) => d.filter((x) => x.id !== doc.id));
    },
  });

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const docs = await documentService.getUserDocuments(user.id);
      // Newest first: most recently uploaded documents at the front.
      docs.sort((a, b) => {
        const da = a.upload_date ? new Date(a.upload_date).getTime() : (Number(a.id) || 0);
        const db = b.upload_date ? new Date(b.upload_date).getTime() : (Number(b.id) || 0);
        return db - da;
      });
      setDocuments(docs);
    } catch (e) {
      setError(e?.detail || e?.message || 'Could not load documents');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box sx={{ width: '100%', p: { xs: 3, md: 4 }, height: '100%', overflowY: 'auto', background: 'var(--color-navy-deep)' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 3.5 }}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 0.95, mb: '14px', maxWidth: '14ch', color: 'var(--color-white)' }}>Documents</Typography>
          <Typography variant="body1" sx={{ maxWidth: '56ch', color: 'color-mix(in srgb, var(--color-white) 74%, transparent)' }}>
            Upload a PDF and study it with its own summary, quiz, cloze, and Feynman practice. Pick a document to open its study session.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setImportOpen(true)}
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
          Add document
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
        {documents.map((doc) => {
          const meta = statusMeta(doc.processing_status);
          return (
            <Box
              key={doc.id}
              onClick={() => navigate(`/documents/${slugify(doc.title)}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/documents/${slugify(doc.title)}`); } }}
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
              <Box sx={{ position: 'relative', height: 132, background: '#000', overflow: 'hidden' }}>
                {/* Renders the document's first page (backend thumbnail); falls back to the title on black */}
                <PdfCover url={documentService.getBookCoverUrl(doc.id)} fallbackTitle={doc.title} />
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
              <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
                    {doc.title}
                  </Typography>
                  <ItemMenu onRename={() => openRename(doc)} onDelete={() => handleDeleteDocument(doc)} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
                  <Chip
                    size="small"
                    label={meta.label}
                    sx={{
                      height: 22,
                      fontWeight: 700,
                      color: 'var(--color-white)',
                      bgcolor: `color-mix(in srgb, ${meta.color} 18%, transparent)`,
                    }}
                  />
                  <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)', fontWeight: 600 }}>
                    Open study session
                  </Typography>
                </Box>
              </Box>
            </Box>
          );
        })}

        {/* Dashed "coming soon" slots so a fresh library never looks empty.
            Each fills the same footprint as a real card; they disappear as the
            user adds documents (up to 8 cards on screen). */}
        {!loading && !error && Array.from({ length: Math.max(0, 8 - documents.length) }).map((_, i) => (
          <Box
            key={`doc-slot-${i}`}
            role="button"
            tabIndex={0}
            onClick={() => setImportOpen(true)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setImportOpen(true); } }}
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
            {/* Dashed "+" — the invitation to drop a document into this slot */}
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
                Add a document to this space
              </Typography>
              <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 48%, transparent)', fontSize: 13, lineHeight: 1.55, mt: 0.6, maxWidth: 224, mx: 'auto' }}>
                Upload a PDF — it becomes its own study space with summary, quiz, cloze, and Feynman practice.
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <RenameDialog
        open={renameState.open}
        initialValue={renameState.doc?.title || ''}
        onClose={closeRename}
        onSubmit={submitRename}
        submitting={renameState.saving}
        title="Rename document"
        label="Document title"
      />
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={runConfirm}
        onClose={closeConfirm}
        confirming={confirmState.confirming}
      />

      <DocumentImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={load}
      />
    </Box>
  );
};

export default Documents;
