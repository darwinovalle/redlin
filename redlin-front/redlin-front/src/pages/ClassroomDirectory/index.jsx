import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ImageIcon from '@mui/icons-material/Image';
import { classroomService } from '../../services/api/classroom';
import ItemMenu from '../../components/common/ItemMenu';
import RenameDialog from '../../components/common/RenameDialog';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ClassroomModal from '../../components/common/ClassroomModal';
import liveTranscribeSvg from '../../assets/live-transcribe.svg';

const statusMeta = (status) => {
  if (status === 'completed' || status === 'ready') return { label: 'Ready', color: 'var(--color-success)' };
  if (status === 'failed') return { label: 'Failed', color: 'var(--color-danger-soft)' };
  if (status === 'recording') return { label: 'Recording', color: 'var(--color-danger)' };
  if (status === 'transcribing' || status === 'processing') return { label: 'Processing', color: 'var(--color-teal)' };
  return { label: status || 'Space', color: 'color-mix(in srgb, var(--color-white) 55%, transparent)' };
};

// Cover: the uploaded image, or the live-transcribe logo on white as fallback.
const ClassCover = ({ url, title }) => {
  if (url) {
    return (
      <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#000' }}>
        <img src={url} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </Box>
    );
  }
  return (
    <Box sx={{ position: 'absolute', inset: 0, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img src={liveTranscribeSvg} alt="" style={{ width: 84, height: 84, objectFit: 'contain' }} />
      <Typography variant="h6" sx={{ position: 'absolute', left: 0, right: 0, bottom: 10, textAlign: 'center', color: 'rgba(0,0,0,0.7)', fontWeight: 700, lineHeight: 1.12, px: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {title}
      </Typography>
    </Box>
  );
};

// Classroom directory: every space as a card with its cover (or the logo fallback),
// click-through to the space, rename/delete, and dashed placeholders — the same
// implementation as the Documents / Books / Videos grids.
// Small dialog to pick a cover image for a space (add now, or change later).
const ChangeCoverDialog = ({ open, session, uploading, onClose, onSave }) => {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (open) { setFile(null); setPreview(null); }
  }, [open]);
  const pick = (f) => {
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };
  return (
    <Dialog
      open={open}
      onClose={uploading ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        style: { background: 'linear-gradient(135deg, var(--color-navy-050) 0%, var(--color-navy-200) 48%, var(--color-navy) 100%)' },
        sx: { width: { xs: '92vw', sm: 520 }, maxWidth: '92vw', borderRadius: '20px', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', overflow: 'hidden', position: 'relative' },
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
              <ImageIcon fontSize="small" />
            </Box>
            <Box>
              <Typography id="cover-dialog-title" variant="h6" sx={{ color: 'var(--color-white)', fontWeight: 700, letterSpacing: '-0.01em' }}>
                {session?.cover_image_url ? 'Change cover image' : 'Add cover image'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 62%, transparent)' }}>
                This image shows on the space's card.
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small" disabled={uploading} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Dot-pattern drop area */}
        <Box
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); pick(e.dataTransfer?.files?.[0]); }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          sx={{
            border: '1px solid color-mix(in srgb, var(--color-teal) 34%, transparent)',
            borderRadius: '16px',
            p: { xs: 3, md: 4 },
            textAlign: 'center',
            backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--color-teal) 13%, transparent) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        >
          {preview ? (
            <>
              <img src={preview} alt="Cover preview" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, display: 'block', margin: '0 auto 12px', background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }} />
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Button variant="contained" disabled={!file || uploading} onClick={() => file && onSave(file)} sx={{ borderRadius: 999, px: 4, py: 1.1, background: 'var(--color-teal)', color: 'var(--color-navy-deep)', fontWeight: 700, textTransform: 'none', boxShadow: '0 10px 28px color-mix(in srgb, var(--color-teal) 30%, transparent)', '&:hover': { background: 'var(--color-teal-pale)' } }}>
                  {uploading ? 'Saving…' : 'Save image'}
                </Button>
                <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} sx={{ borderRadius: 999, px: 3, py: 1.1, color: 'var(--color-white)', border: '1px solid color-mix(in srgb, var(--color-white) 22%, transparent)', textTransform: 'none', fontWeight: 700, '&:hover': { borderColor: 'var(--color-teal)' } }}>
                  Choose different
                </Button>
              </Box>
            </>
          ) : (
            <>
              <Box sx={{ width: 64, height: 64, mx: 'auto', mb: 2, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed color-mix(in srgb, var(--color-teal) 45%, transparent)', color: 'var(--color-teal)' }}>
                <ImageIcon sx={{ fontSize: 30 }} />
              </Box>
              <Typography variant="h6" sx={{ mb: 0.5, color: 'var(--color-white)', fontWeight: 700 }}>Choose a cover image</Typography>
              <Typography variant="body2" sx={{ mb: 2.5, color: 'color-mix(in srgb, var(--color-white) 68%, transparent)', maxWidth: 360, mx: 'auto', lineHeight: 1.5 }}>
                Drag &amp; drop an image here, or choose one from your files. If none is set, the live-transcribe logo on white is used.
              </Typography>
              <Button variant="contained" onClick={() => fileInputRef.current?.click()} disabled={uploading} sx={{ borderRadius: 999, px: 4, py: 1.1, background: 'var(--color-teal)', color: 'var(--color-navy-deep)', fontWeight: 700, textTransform: 'none', boxShadow: '0 10px 28px color-mix(in srgb, var(--color-teal) 30%, transparent)', '&:hover': { background: 'var(--color-teal-pale)' } }}>
                Choose file
              </Button>
            </>
          )}
        </Box>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { pick(e.target.files?.[0]); if (fileInputRef.current) fileInputRef.current.value = ''; }} />
      </Box>
    </Dialog>
  );
};

const ClassroomDirectory = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState(null);
  const [renameState, setRenameState] = useState({ open: false, session: null, saving: false });
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null, confirming: false });
  const [coverState, setCoverState] = useState({ open: false, session: null, uploading: false });

  const openConfirm = ({ title, message, onConfirm }) => (
    setConfirmState({ open: true, title, message, onConfirm, confirming: false })
  );
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
  const openRename = (session) => setRenameState({ open: true, session, saving: false });
  const closeRename = () => setRenameState({ open: false, session: null, saving: false });
  const submitRename = async (newTitle) => {
    if (!renameState.session) return;
    try {
      setRenameState((s) => ({ ...s, saving: true }));
      await classroomService.renameSession(renameState.session.id, newTitle.trim());
      setSessions((d) => d.map((x) => (x.id === renameState.session.id ? { ...x, title: newTitle.trim() } : x)));
      closeRename();
    } catch (e) {
      setError(e?.error || 'Rename failed');
      setRenameState((s) => ({ ...s, saving: false }));
    }
  };
  const handleDeleteSession = (session) => openConfirm({
    title: 'Delete space?',
    message: `Are you sure you want to delete "${session.title}"? Its content will be removed too. This cannot be undone.`,
    onConfirm: async () => {
      await classroomService.deleteSession(session.id);
      setSessions((d) => d.filter((x) => x.id !== session.id));
    },
  });
  const handleSaveCover = async (file) => {
    const session = coverState.session;
    if (!session || !file || coverState.uploading) return;
    setCoverState((s) => ({ ...s, uploading: true }));
    try {
      const updated = await classroomService.uploadCover(session.id, file);
      const url = updated?.cover_image_url || null;
      setSessions((d) => d.map((x) => (x.id === session.id ? { ...x, cover_image_url: url || x.cover_image_url } : x)));
      setCoverState({ open: false, session: null, uploading: false });
    } catch (e) {
      console.error('Cover save failed', e);
      setError(e?.response?.data?.detail || 'Failed to save the image');
      setCoverState((s) => ({ ...s, uploading: false }));
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await classroomService.listSessions();
      setSessions(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e?.detail || e?.message || 'Could not load classroom spaces');
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
          <Typography variant="h3" sx={{ fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 0.95, mb: '14px', maxWidth: '14ch', color: 'var(--color-white)' }}>Classroom Spaces</Typography>
          <Typography variant="body1" sx={{ maxWidth: '56ch', color: 'color-mix(in srgb, var(--color-white) 74%, transparent)' }}>
            Create a space to capture and study a live session. Pick a space to open it, or add a new one with a custom cover.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ borderRadius: '999px', px: 3, py: 1.15, fontWeight: 700, textTransform: 'none', flexShrink: 0, backgroundColor: 'var(--color-teal)', color: 'var(--color-navy-deep)', boxShadow: '0 10px 28px color-mix(in srgb, var(--color-teal) 30%, transparent)', '&:hover': { backgroundColor: 'var(--color-teal-pale)' } }}>
          Add space
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

      {/* Card grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 3 }}>
        {sessions.map((session) => {
          const meta = statusMeta(session.status);
          return (
            <Box
              key={session.id}
              onClick={() => navigate(`/classroom/${session.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/classroom/${session.id}`); } }}
              sx={{
                cursor: 'pointer',
                borderRadius: '20px',
                background: 'color-mix(in srgb, var(--color-navy-700) 70%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform .2s cubic-bezier(.2,.8,.2,1), border-color .2s, box-shadow .2s',
                '&:hover': { transform: 'translateY(-4px)', borderColor: 'color-mix(in srgb, var(--color-teal) 55%, transparent)', boxShadow: '0 18px 44px color-mix(in srgb, var(--color-black) 42%, transparent)' },
                '&:focus-visible': { outline: '2px solid var(--color-teal)', outlineOffset: '2px' },
              }}
            >
              {/* Cover */}
              <Box sx={{ position: 'relative', height: 132, overflow: 'hidden' }}>
                <ClassCover url={session.cover_image_url} title={session.title} />
              </Box>

              {/* Body */}
              <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                  <Typography variant="h6" sx={{ flex: 1, minWidth: 0, fontWeight: 700, lineHeight: 1.12, color: 'var(--color-white)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {session.title}
                  </Typography>
                  <ItemMenu onRename={() => openRename(session)} onDelete={() => handleDeleteSession(session)} onAddImage={() => setCoverState({ open: true, session, uploading: false })} addImageLabel={session.cover_image_url ? 'Change image' : 'Add image'} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
                  <Chip size="small" label={meta.label} sx={{ height: 22, fontWeight: 700, color: 'var(--color-white)', bgcolor: `color-mix(in srgb, ${meta.color} 18%, transparent)` }} />
                  <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)', fontWeight: 600 }}>Open space</Typography>
                </Box>
              </Box>
            </Box>
          );
        })}

        {/* Dashed placeholders */}
        {!loading && !error && Array.from({ length: Math.max(0, 8 - sessions.length) }).map((_, i) => (
          <Box key={`class-slot-${i}`} role="button" tabIndex={0} onClick={() => setAddOpen(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAddOpen(true); } }} sx={{ cursor: 'pointer', borderRadius: '20px', border: '1px dashed color-mix(in srgb, var(--color-white) 20%, transparent)', background: 'color-mix(in srgb, var(--color-navy-700) 30%, transparent)', minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 4, gap: 1.5, '&:hover': { transform: 'translateY(-4px)', borderColor: 'color-mix(in srgb, var(--color-teal) 55%, transparent)' }, '&:focus-visible': { outline: '2px solid var(--color-teal)', outlineOffset: '2px' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 58, height: 58, borderRadius: '50%', border: '1px dashed color-mix(in srgb, var(--color-white) 22%, transparent)', mb: 0.5 }}>
              <AddIcon sx={{ fontSize: 26, color: 'color-mix(in srgb, var(--color-white) 32%, transparent)' }} />
            </Box>
            <Box>
              <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 74%, transparent)', fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>Add a space to this grid</Typography>
              <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 48%, transparent)', fontSize: 13, lineHeight: 1.55, mt: 0.6, maxWidth: 224, mx: 'auto' }}>Create a classroom space and give it a cover image — or let the logo default.</Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <RenameDialog open={renameState.open} initialValue={renameState.session?.title || ''} onClose={closeRename} onSubmit={submitRename} submitting={renameState.saving} title="Rename space" label="Space title" />
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} onConfirm={runConfirm} onClose={closeConfirm} confirming={confirmState.confirming} />

      <ClassroomModal open={addOpen} onClose={() => setAddOpen(false)} onImported={load} />
      <ChangeCoverDialog open={coverState.open} session={coverState.session} uploading={coverState.uploading} onClose={() => setCoverState({ open: false, session: null, uploading: false })} onSave={handleSaveCover} />
    </Box>
  );
};

export default ClassroomDirectory;