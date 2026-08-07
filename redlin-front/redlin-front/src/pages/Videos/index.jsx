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
    <Box sx={{ width: '100%', p: { xs: 3, md: 4 }, height: '100%', overflowY: 'auto', background: 'var(--color-navy-deep)' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 3.5 }}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 0.95, mb: '14px', maxWidth: '14ch', color: 'var(--color-white)' }}>Videos</Typography>
          <Typography variant="body1" sx={{ maxWidth: '56ch', color: 'color-mix(in srgb, var(--color-white) 74%, transparent)' }}>
            Add a YouTube video and study it with its own summary, quiz, cloze, and Feynman practice. Pick a video to open its study session.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddOpen(true)}
          sx={{
            borderRadius: '999px',
            px: 3,
            py: 1.15,
            fontWeight: 700,
            textTransform: 'none',
            flexShrink: 0,
            backgroundColor: 'var(--color-danger)',
            color: '#fff',
            boxShadow: '0 10px 28px color-mix(in srgb, var(--color-danger) 30%, transparent)',
            '&:hover': { backgroundColor: 'var(--color-danger-deep)' },
          }}
        >
          Add video
        </Button>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress sx={{ color: 'var(--color-danger-soft)' }} />
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
                background: 'color-mix(in srgb, var(--color-navy-700) 70%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform .2s cubic-bezier(.2,.8,.2,1), border-color .2s, box-shadow .2s',
                '&:hover': { transform: 'translateY(-4px)', borderColor: 'color-mix(in srgb, var(--color-danger-soft) 55%, transparent)', boxShadow: '0 18px 44px color-mix(in srgb, var(--color-black) 42%, transparent)' },
                '&:focus-visible': { outline: '2px solid var(--color-danger-soft)', outlineOffset: '2px' },
              }}
            >
              {/* Cover */}
              <Box sx={{ position: 'relative', height: 132, background: '#000', overflow: 'hidden' }}>
                <VideoCover videoId={videoId} title={video.title || video.video_id || `Video ${video.id}`} />
                <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 7, zIndex: 1, background: 'linear-gradient(180deg, color-mix(in srgb, var(--color-black) 26%, transparent), color-mix(in srgb, var(--color-black) 10%, transparent))' }} />
                <Box sx={{ position: 'absolute', inset: 0, zIndex: 1, boxShadow: 'inset 0 -40px 60px color-mix(in srgb, var(--color-black) 22%, transparent)' }} />
              </Box>

              {/* Body */}
              <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 58, height: 58, borderRadius: '50%', border: '1px dashed color-mix(in srgb, var(--color-white) 22%, transparent type)', mb: 0.5 }}>
              <AddIcon sx={{ fontSize: 26, color: 'color-mix(in srgb, var(--color-white) 32%, transparent)' }} />
            </Box>
            <Box>
              <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 74%, transparent)', fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>
                Add a video to this space
              </Typography>
              <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 48%, transparent)', fontSize: 13, lineHeight: 1.55, mt: 0.6, maxWidth: 224, mx: 'auto' }}>
                Paste a YouTube URL — it becomes its own study space with summary, quiz, cloze, and Feynman practice.
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <RenameDialog open={renameState.open} initialValue={renameState.video?.title || ''} onClose={closeRename} onSubmit={submitRename} submitting={renameState.saving} title="Rename video" label="Video title" />
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} onConfirm={runConfirm} onClose={closeConfirm} confirming={confirmState.confirming} />

      <VideoImportModal open={addOpen} onClose={() => setAddOpen(false)} onImported={load} />
    </Box>
  );
};

export default Videos;