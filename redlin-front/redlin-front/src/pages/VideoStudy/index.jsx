import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStudySession } from '../../hooks/useStudySession';
import { videoService } from '../../services/api/video';
import { Box, Typography, CircularProgress, IconButton, TextField } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import VideoStudyPanel from '../../components/Video/VideoStudyPanel';
import '../Dashboard/dashboard.css';

// Extract short "key takeaways" bullets from the summary markdown, preferring a
// Key Takeaways / Conclusion / Recap section; falls back to the first bullets.
const getKeyTakeaways = (content) => {
  if (!content) return [];
  const lines = content.split('\n');
  const result = [];
  let inTake = false;
  for (const raw of lines) {
    const t = raw.trim();
    if (/^#{1,6}\s*(key takeaways|conclusion|recap|summary|what i learned)/i.test(t)) { inTake = true; continue; }
    if (inTake && /^#{1,6}\s/.test(t)) inTake = false;
    if (inTake && /^[-*•]\s+/.test(t)) {
      const item = raw.replace(/^[-*•]\s+/, '').replace(/\*\*([^*]*)\*\*/g, '$1').trim();
      if (item) result.push(item);
    }
  }
  if (!result.length) {
    for (const raw of lines) {
      if (/^[-*•]\s+/.test(raw.trim())) {
        const item = raw.trim().replace(/^[-*•]\s+/, '').replace(/\*\*([^*]*)\*\*/g, '$1');
        if (item) result.push(item);
      }
    }
  }
  return Array.from(new Set(result)).slice(0, 8);
};

const VideoStudy = () => {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null); // { video, summary, mcqs }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Auto-record study time while this video study page stays open.
  useStudySession({ model: 'video', itemId: videoId });
  // Study notes below the player, auto-saved to this browser for the video.
  const [notes, setNotes] = useState(() => {
    try { return localStorage.getItem(`videos:notes:${videoId}`) || ''; } catch { return ''; }
  });
  const handleNotes = (v) => {
    setNotes(v);
    try { localStorage.setItem(`videos:notes:${videoId}`, v); } catch {}
  };

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    (async () => {
      try {
        const full = await videoService.getFullDetails(videoId);
        if (!ignore) setData(full);
      } catch (e) {
        if (!ignore) setError(e?.response?.data?.error || 'Failed to load video');
      } finally { if (!ignore) setLoading(false); }
    })();
    return () => { ignore = true; };
  }, [videoId]);

  if (loading) return (
    <Box sx={{ p: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
      <CircularProgress size={24} sx={{ color: 'var(--color-danger-soft)' }} />
      <Typography variant="body2" sx={{ color: 'var(--color-white)' }}>Loading video...</Typography>
    </Box>
  );
  if (error) return <Box sx={{ p: 4 }}><Typography color="error.main">{error}</Typography></Box>;
  if (!data) return null;

  const { video, summary, mcqs } = data;
  const takeaways = getKeyTakeaways(summary?.content);
  const embedSrc = videoService.embedUrl(video);

  return (
    <div className="dashboard-root">
      {/* Return hero header — back to /videos */}
      <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2, px: 4, py: 2.5, borderBottom: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)', background: 'var(--color-navy-deep)' }}>
        <IconButton
          onClick={() => navigate('/videos')}
          size="small"
          aria-label="Back to videos"
          title="Back to videos"
          sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}
        >
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ color: 'var(--color-white)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {video.title || video.video_id || 'Video ' + video.id}
          </Typography>
          <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>
            Video study · Summary · MCQs · Cloze · Feynman
          </Typography>
        </Box>
      </Box>

      {/* Video + study panel */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        <Box sx={{ flex: 1, minWidth: 0, height: '100%', overflowY: 'auto', borderRight: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)', background: 'var(--color-navy-deep)' }}>
          {embedSrc && (
            <Box sx={{ position: 'relative', pb: '56.25%', height: 0, overflow: 'hidden' }}>
              <iframe
                src={embedSrc}
                title="YouTube video"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              />
            </Box>
          )}

          {/* Key takeaways below the player */}
          {takeaways.length > 0 && (
            <Box sx={{ px: 3, pt: 2.5 }}>
              <Typography variant="overline" sx={{ letterSpacing: 2.5, color: 'color-mix(in srgb, var(--color-white) 50%, transparent)', display: 'block', mb: 1 }}>
                ✨ Key takeaways
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {takeaways.map((t, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, borderRadius: 2, px: 1.5, py: 1, background: 'color-mix(in srgb, var(--color-white) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)' }}>
                    <CheckCircleOutlineIcon sx={{ fontSize: 16, color: 'var(--color-teal)', flexShrink: 0, mt: '2px' }} />
                    <Typography variant="body2" sx={{ color: 'var(--color-white)', lineHeight: 1.4, fontSize: 14 }}>{t}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Notes area below the player */}
          <Box sx={{ px: 3, py: 2.5 }}>
            <Typography variant="overline" sx={{ letterSpacing: 2.5, color: 'color-mix(in srgb, var(--color-white) 50%, transparent)', display: 'block', mb: 1 }}>
              📝 Study notes
            </Typography>
            <TextField
              value={notes}
              onChange={(e) => handleNotes(e.target.value)}
              multiline
              minRows={4}
              fullWidth
              placeholder="Jot down key ideas, timestamps, or questions here... (auto-saved)"
              sx={{ '& .MuiOutlinedInput-root': { color: 'var(--color-white)', backgroundColor: 'color-mix(in srgb, var(--color-white) 3%, transparent)', '& fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 12%, transparent)' }, '&:hover fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 22%, transparent)' }, '&.Mui-focused fieldset': { borderColor: 'var(--color-danger-soft)' } } }}
            />
          </Box>
        </Box>
        <div className="study-panel" style={{ width: 540, flexShrink: 0 }}>
          <VideoStudyPanel video={video} summary={summary} mcqs={mcqs} />
        </div>
      </Box>
    </div>
  );
};

export default VideoStudy;