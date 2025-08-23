import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { videoService } from '../../services/api/video';
import { Box, Typography, CircularProgress, Chip, Tabs, Tab, Divider } from '@mui/material';
import VideoSummary from '../../components/Video/VideoSummary';
import VideoQuiz from '../../components/Video/VideoQuiz';

const VideoStudy = () => {
  const { videoId } = useParams();
  const [data, setData] = useState(null); // { video, summary, mcqs }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Tab must be declared before any conditional early returns to keep hook order stable
  const [tab, setTab] = useState(0);

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

  if (loading) return <Box sx={{ p: 4, display:'flex', alignItems:'center', gap:2 }}><CircularProgress size={24} /> <Typography variant="body2">Loading video...</Typography></Box>;
  if (error) return <Box sx={{ p:4 }}><Typography color="error.main">{error}</Typography></Box>;
  if (!data) return null;

  const { video, summary, mcqs } = data;
  const embedSrc = videoService.embedUrl(video);

  return (
    <Box sx={{ width:'100%', display:'flex', flexDirection:'row', height:'100vh', overflow:'hidden' }}>
      {/* Center video area similar to PDF viewer slot */}
      <Box sx={{ flex:1, width: '1000', height:'100%', overflow:'auto', p:3 }}>
        {/* <Typography variant="h5" sx={{ mb:1 }}>{video.title || video.video_id || 'Video ' + video.id}</Typography>
        <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:2 }}>
          <Chip size="small" label={video.processing_status} color={video.processing_status==='completed' ? 'success':'default'} />
          <Typography variant="caption" color="text.secondary">Snippets: {video.snippet_count}</Typography>
        </Box> */}
        {embedSrc && (
          <Box sx={{ position:'relative', pb:'56.25%', borderRadius:2, overflow:'hidden' }}>
            <iframe
              src={embedSrc}
              title="YouTube video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%' }}
            />
          </Box>
        )}
      </Box>
      {/* Right study panel mimic Dashboard right column */}
      <Box sx={{ width:400, height:'100%', overflow:'auto', borderLeft:'1px solid #eee', display:'flex', flexDirection:'column', backgroundColor: '#1e1e1e' }}>
        <Tabs value={tab} onChange={(e,v)=>setTab(v)} centered sx={{ '& .MuiTabs-indicator': { backgroundColor:'#ffffff' } }}>
          <Tab label="Summary" sx={{ fontSize: '15px' ,fontWeight: 900, color: '#ffffff', '&.Mui-selected': { color: '#ffffff' } }} />
          <Tab label="Quiz" sx={{ fontSize: '15px' ,fontWeight: 900, color: '#ffffff', '&.Mui-selected': { color: '#ffffff' } }} />
        </Tabs>
        <Box sx={{ flex:1, overflow:'auto', p:2 }}>
          {tab===0 && (
            <VideoSummary summary={summary} loading={false} error={null} />
          )}
          {tab===1 && (
            <VideoQuiz mcqs={mcqs} />
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default VideoStudy;
