import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import { videoService } from '../../services/api/video';
import ItemMenu from '../../components/common/ItemMenu';
import RenameDialog from '../../components/common/RenameDialog';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import VideoImportModal from '../../components/common/VideoImportModal';

const statusMeta = (status) => {
  if (status === 'completed') return { label: 'Ready', color: 'var(--color-success)' };
  if (status === 'failed') return { label: 'Failed', color: 'var(--color-danger-soft)' };
  return { label: 'Processing', color: 'var(--color-danger-soft)' };
};

// YouTube thumbnail for the cover, over black, with the title as fallback.
const VideoCover = ({ videoId, title }) => {
  const [failed, setFailed] = useState(false);
  if (!videoId || failed) {
    return (
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', p: 2.5 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            lineHeight: 1.12,
            color: '#fff',
            textShadow: '0 1px 12px rgba(0,0,0,0.6)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {title}
        </Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#000' }}>
      <img
        src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
        alt=""
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </Box>
  );
};

// Video directory: every study video as a card with its YouTube thumbnail,
// click-through to its study session, rename/delete, and dashed placeholders —
// the same implementation as the Documents grid.
const Videos = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState(null);
  const [renameState, setRenameState] = useState({ open: false, video: null, saving: false });
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null, confirming: false });

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
  const openRename = (video) => setRenameState({ open: true, video, saving: false });
  const closeRename = () => setRenameState({ open: false, video: null, saving: false });
  const submitRename = async (newTitle) => {
    if (!renameState.video) return;
    try {
      setRenameState((s) => ({ ...s, saving: true }));
      await videoService.renameVideo(renameState.video.id, newTitle.trim());
      setVideos((d) => d.map((x) => (x.id === renameState.video.id ? { ...x, title: newTitle.trim() } : x)));
      closeRename();
    } catch (e) {
      setError(e?.error || 'Rename failed');
      setRenameState((s) => ({ ...s, saving: false }));
    }
  };
  const handleDeleteVideo = (video) => openConfirm({
    title: 'Delete video?',
    message: `Are you sure you want to delete "${video.title || video.video_id || 'this video'}"? Its study content will be removed too. This cannot be undone.`,
    onConfirm: async () => {
      await videoService.deleteVideo(video.id);
      setVideos((d) => d.filter((x) => x.id !== video.id));
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await videoService.listVideos();
      // Newest first: most recently added videos at the front.
      list.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : (Number(a.id) || 0);
        const db = b.created_at ? new Date(b.created_at).getTime() : (Number(b.id) || 0);
        return db - da;
      });
      setVideos(list);
    } catch (e) {
      setError(e?.detail || e?.message || 'Could not load videos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', overflowX: 'hidden', background: 'radial-gradient(circle, color-mix(in srgb, var(--color-navy) 30%, transparent) 1px, transparent 1.5px), #FFFFFF', backgroundSize: '22px 22px' }}>
      {/* Hero — full-width navy panel with decorative glow bubbles */}
      <Box sx={{ position: 'relative', width: '100%', mb: { xs: 4, md: 6 }, overflow: 'hidden', background: 'var(--color-navy-deep)' }}>
        <Box sx={{ position: 'absolute', top: -80, right: -40, width: 288, height: 288, borderRadius: '50%', background: 'radial-gradient(circle, rgba(127, 99, 244, 0.35), transparent 70%)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', bottom: -96, left: '33.33%', width: 288, height: 288, borderRadius: '50%', background: 'radial-gradient(circle, rgba(32, 201, 151, 0.3), transparent 70%)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'relative', maxWidth: 1500, mx: 'auto', px: { xs: '24px', md: '40px' }, py: { xs: '48px', md: '64px' } }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-teal)', mb: 2 }}>
            Video library
          </Box>
          <Typography component="h1" sx={{ fontFamily: "'Poppins', 'Titillium Web', sans-serif", fontWeight: 700, lineHeight: 1.1, fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', color: 'var(--color-white)' }}>
            Videos
          </Typography>
          <Typography sx={{ color: '#B0B7C3', mt: 1.5, maxWidth: 672, fontSize: 15, lineHeight: 1.6 }}>
            Add a YouTube video and study it with its own summary, quiz, cloze, and Feynman practice. Pick a video to open its study session.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ mt: 3.5, height: 48, px: 3, borderRadius: '999px', backgroundColor: 'var(--color-teal)', color: 'var(--color-white)', fontWeight: 600, fontSize: 14, textTransform: 'none', boxShadow: '0 6px 20px rgba(32, 201, 151, 0.5)', transition: 'all .2s ease', '&:hover': { backgroundColor: 'var(--color-teal-hover)', transform: 'translateY(-2px)' } }}>
            Add video
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

      {/* Card grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 3 }}>
        {videos.map((video) => {
          const meta = statusMeta(video.processing_status);
          const videoId = video.video_id || videoService.extractVideoId(video.url);
          return (
            <Box
              key={video.id}
              onClick={() => navigate(`/videos/${video.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/videos/${video.id}`); } }}
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
                '&:hover': { transform: 'translateY(-4px)', borderColor: 'color-mix(in srgb, var(--color-teal) 55%, transparent)', boxShadow: '0 18px 44px color-mix(in srgb, var(--color-black) 42%, transparent)' },
                '&:focus-visible': { outline: '2px solid var(--color-teal)', outlineOffset: '2px' },
              }}
            >
              {/* Cover */}
              <Box sx={{ position: 'relative', flex: '0 0 65%', minHeight: 0, background: '#000', overflow: 'hidden' }}>
                <VideoCover videoId={videoId} title={video.title || video.video_id || `Video ${video.id}`} />
                <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 7, zIndex: 1, background: 'linear-gradient(180deg, color-mix(in srgb, var(--color-black) 26%, transparent), color-mix(in srgb, var(--color-black) 10%, transparent))' }} />
                <Box sx={{ position: 'absolute', inset: 0, zIndex: 1, boxShadow: 'inset 0 -40px 60px color-mix(in srgb, var(--color-black) 22%, transparent)' }} />
              </Box>

              {/* Body */}
              <Box sx={{ flex: 1, minHeight: 0, p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5, justifyContent: 'center', background: 'linear-gradient(135deg, #1A5C4E 0%, #10443A 50%, #0A2F2A 100%)' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                  <Typography
                    variant="h6"
                    sx={{ flex: 1, minWidth: 0, fontWeight: 700, lineHeight: 1.12, color: 'var(--color-white)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                  >
                    {video.title || video.video_id || `Video ${video.id}`}
                  </Typography>
                  <ItemMenu onRename={() => openRename(video)} onDelete={() => handleDeleteVideo(video)} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
                  <Chip size="small" label={meta.label} sx={{ height: 22, fontWeight: 700, color: 'var(--color-white)', bgcolor: `color-mix(in srgb, ${meta.color} 18%, transparent)` }} />
                  <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)', fontWeight: 600 }}>Open study session</Typography>
                </Box>
              </Box>
            </Box>
          );
        })}

        {/* Dashed placeholders */}
        {!loading && !error && Array.from({ length: Math.max(0, 8 - videos.length) }).map((_, i) => (
          <Box
            key={`video-slot-${i}`}
            role="button"
            tabIndex={0}
            onClick={() => setAddOpen(true)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAddOpen(true); } }}
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
              '&:hover': { transform: 'translateY(-4px)', borderColor: 'color-mix(in srgb, var(--color-teal) 60%, transparent)', boxShadow: '0 14px 30px color-mix(in srgb, var(--color-navy) 16%, transparent)' },
              '&:focus-visible': { outline: '2px solid var(--color-teal)', outlineOffset: '2px' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 58, height: 58, borderRadius: '50%', border: '2px dashed color-mix(in srgb, var(--color-navy) 40%, transparent)', mb: 0.5 }}>
              <AddIcon sx={{ fontSize: 26, color: 'color-mix(in srgb, var(--color-navy) 55%, transparent)' }} />
            </Box>
            <Box>
              <Typography sx={{ color: 'var(--color-text)', fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>
                Add a video to this space
              </Typography>
              <Typography sx={{ color: 'var(--color-text-mid)', fontSize: 13, lineHeight: 1.55, mt: 0.6, maxWidth: 224, mx: 'auto' }}>
                Paste a YouTube URL — it becomes its own study space with summary, quiz, cloze, and Feynman practice.
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
      </Box>

      <RenameDialog open={renameState.open} initialValue={renameState.video?.title || ''} onClose={closeRename} onSubmit={submitRename} submitting={renameState.saving} title="Rename video" label="Video title" />
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} onConfirm={runConfirm} onClose={closeConfirm} confirming={confirmState.confirming} />

      <VideoImportModal open={addOpen} onClose={() => setAddOpen(false)} onImported={load} />
    </Box>
  );
};

export default Videos;