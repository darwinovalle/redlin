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
    <Box sx={{ width: '100%', minHeight: '100vh', overflowX: 'hidden', background: 'radial-gradient(circle, color-mix(in srgb, var(--color-navy) 30%, transparent) 1px, transparent 1.5px), #FFFFFF', backgroundSize: '22px 22px' }}>
      {/* Hero — full-width navy panel with decorative glow bubbles */}
      <Box sx={{ position: 'relative', width: '100%', mb: { xs: 4, md: 6 }, overflow: 'hidden', background: 'var(--color-navy-deep)' }}>
        <Box sx={{ position: 'absolute', top: -80, right: -40, width: 288, height: 288, borderRadius: '50%', background: 'radial-gradient(circle, rgba(127, 99, 244, 0.35), transparent 70%)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', bottom: -96, left: '33.33%', width: 288, height: 288, borderRadius: '50%', background: 'radial-gradient(circle, rgba(32, 201, 151, 0.3), transparent 70%)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'relative', maxWidth: 1500, mx: 'auto', px: { xs: '24px', md: '40px' }, py: { xs: '48px', md: '64px' } }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-teal)', mb: 2 }}>
            Study material
          </Box>
          <Typography component="h1" sx={{ fontFamily: "'Poppins', 'Titillium Web', sans-serif", fontWeight: 700, lineHeight: 1.1, fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', color: 'var(--color-white)' }}>
            Documents
          </Typography>
          <Typography sx={{ color: '#B0B7C3', mt: 1.5, maxWidth: 672, fontSize: 15, lineHeight: 1.6 }}>
            Upload a PDF and study it with its own summary, quiz, cloze, and Feynman practice. Pick a document to open its study session.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setImportOpen(true)} sx={{ mt: 3.5, height: 48, px: 3, borderRadius: '999px', backgroundColor: 'var(--color-teal)', color: 'var(--color-white)', fontWeight: 600, fontSize: 14, textTransform: 'none', boxShadow: '0 6px 20px rgba(32, 201, 151, 0.5)', transition: 'all .2s ease', '&:hover': { backgroundColor: 'var(--color-teal-hover)', transform: 'translateY(-2px)' } }}>
            Add document
          </Button>
        </Box>
      </Box>

      <Box sx={{ p: { xs: 3, md: 4 }, pt: 0 }}>
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
                height: 320,
                background: 'linear-gradient(135deg, var(--color-navy-050) 0%, var(--color-navy-200) 48%, var(--color-navy) 100%)',
                border: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)',
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
              <Box sx={{ position: 'relative', flex: '0 0 65%', minHeight: 0, background: '#000', overflow: 'hidden' }}>
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
              <Box sx={{ flex: 1, minHeight: 0, p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5, justifyContent: 'center', background: 'linear-gradient(135deg, #1A5C4E 0%, #10443A 50%, #0A2F2A 100%)' }}>
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
            {/* Dashed "+" — the invitation to drop a document into this slot */}
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
                Add a document to this space
              </Typography>
              <Typography sx={{ color: 'var(--color-text-mid)', fontSize: 13, lineHeight: 1.55, mt: 0.6, maxWidth: 224, mx: 'auto' }}>
                Upload a PDF — it becomes its own study space with summary, quiz, cloze, and Feynman practice.
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
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
