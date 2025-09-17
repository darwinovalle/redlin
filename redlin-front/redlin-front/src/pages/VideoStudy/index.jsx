import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { videoService } from '../../services/api/video';
import { Box, Typography, CircularProgress, Chip, Tabs, Tab, Divider } from '@mui/material';
import VideoSummary from '../../components/Video/VideoSummary';
import VideoQuiz from '../../components/Video/VideoQuiz';
import VideoClozePanel from '../../components/Video/VideoClozePanel';
import VideoFeynmanPanel from '../../components/Video/VideoFeynmanPanel';
import '../Dashboard/dashboard.css';

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
      <Box sx={{ flex:1, width: '1000', height:'100%', overflow:'auto'}}>
        {/* <Typography variant="h5" sx={{ mb:1 }}>{video.title || video.video_id || 'Video ' + video.id}</Typography>
        <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:2 }}>
          <Chip size="small" label={video.processing_status} color={video.processing_status==='completed' ? 'success':'default'} />
          <Typography variant="caption" color="text.secondary">Snippets: {video.snippet_count}</Typography>
        </Box> */}
        {embedSrc && (
          <Box sx={{ position:'relative', pb:'56.25%',  overflow:'hidden' }}>
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
      {/* Right study panel using Dashboard styling */}
      <div className="study-panel" style={{ width: 550 }}>
        <div className="study-header">
          <Tabs
            value={tab}
            onChange={(e,v)=>setTab(v)}
            aria-label="study tabs"
            variant="scrollable"
            allowScrollButtonsMobile
            className="dashboard-tabs"
          >
            <Tab label="SUMMARY" />
            <Tab label="QUIZ" />
            <Tab label="CLOZE" />
            <Tab label="FEYNMAN" />
          </Tabs>
          <div className="progress-strip" data-role="progress">
            <div className="progress-text">&nbsp;</div>
            <div className="progress-bar-outer">
              <div className="progress-bar-fill" style={{ '--progress': '0%' }} />
            </div>
            <div className="progress-text">&nbsp;</div>
          </div>
        </div>
        <div className="study-content-scroll">
          {tab===0 && (
            <VideoSummary summary={summary} loading={false} error={null} />
          )}
          {tab===1 && <VideoQuiz mcqs={mcqs} />}
          {tab===2 && <VideoClozePanel videoId={video.id} />}
          {tab===3 && <VideoFeynmanPanel videoId={video.id} />}
        </div>
      </div>
    </Box>
  );
};

export default VideoStudy;
