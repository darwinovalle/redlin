import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import LockIcon from '@mui/icons-material/Lock';
import VideoSummary from './VideoSummary';
import VideoQuiz from './VideoQuiz';
import VideoClozePanel from './VideoClozePanel';
import VideoFeynmanPanel from './VideoFeynmanPanel';
import '../../pages/Dashboard/dashboard.css';

// Video study panel (Summary / MCQs / Cloze / Feynman) + Focus Mode, mirroring
// the document StudyPanel exactly (same tabs, hero, and focus dialog).
const VideoStudyPanel = ({ video, summary, mcqs }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [focusMode, setFocusMode] = useState(() => {
    try {
      const stored = localStorage.getItem('study:focusMode');
      return stored === null ? true : stored === '1';
    } catch {
      return true;
    }
  });
  const [focusSession, setFocusSession] = useState(null);
  const [focusKey, setFocusKey] = useState(0);

  useEffect(() => {
    try { localStorage.setItem('study:focusMode', focusMode ? '1' : '0'); } catch {}
  }, [focusMode]);

  const openFocus = (type) => { setFocusKey((k) => k + 1); setFocusSession(type); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      {/* Tabs */}
      <div className="study-header" style={{ padding: '0 16px' }}>
        <Tabs value={activeTab} onChange={(_e, v) => setActiveTab(v)}>
          <Tab label="SUMMARY" />
          <Tab label="MCQS" />
          <Tab label="CLOZE" />
          <Tab label="FEYNMAN" />
        </Tabs>
        <div className="study-divider" aria-hidden="true" />
      </div>

      <div className="study-content-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div role="tabpanel" hidden={activeTab !== 0} style={{ height: '100%' }}>
          {activeTab === 0 && (
            <VideoSummary summary={summary} title={video.title || video.video_id || 'Video ' + video.id} />
          )}
        </div>
        <div role="tabpanel" hidden={activeTab !== 1} style={{ height: '100%' }}>
          {activeTab === 1 && (
            <VideoQuiz mcqs={mcqs} videoId={videoId} focus={focusMode} onFocusChange={setFocusMode} onStart={() => openFocus('quiz')} />
          )}
        </div>
        <div role="tabpanel" hidden={activeTab !== 2} style={{ height: '100%' }}>
          {activeTab === 2 && (
            <VideoClozePanel videoId={video.id} focus={focusMode} onFocusChange={setFocusMode} onStart={() => openFocus('cloze')} />
          )}
        </div>
        <div role="tabpanel" hidden={activeTab !== 3} style={{ height: '100%' }}>
          {activeTab === 3 && (
            <VideoFeynmanPanel videoId={video.id} focus={focusMode} onFocusChange={setFocusMode} onStart={() => openFocus('feynman')} />
          )}
        </div>
      </div>

      {/* Focus Mode dialog */}
      <Dialog
        open={Boolean(focusSession)}
        onClose={() => setFocusSession(null)}
        fullWidth
        maxWidth="md"
        PaperProps={{
          style: { backgroundColor: '#1A2A3A' },
          sx: { borderRadius: '20px', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', maxHeight: '92vh', overflow: 'hidden' },
        }}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'color-mix(in srgb, var(--color-navy-deep) 74%, transparent)',
              backdropFilter: 'blur(10px)',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <LockIcon sx={{ color: 'var(--color-teal)', fontSize: 18 }} />
            <Typography sx={{ color: 'var(--color-white)', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
              Focus Mode · {focusSession === 'quiz' ? 'MCQs' : focusSession === 'cloze' ? 'Cloze' : 'Feynman'}
            </Typography>
          </Stack>
          <IconButton onClick={() => setFocusSession(null)} size="small" sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <DialogContent sx={{ p: { xs: 1.5, sm: 3 }, overflowY: 'auto' }}>
          {focusSession === 'quiz' && <VideoQuiz key={focusKey} mcqs={mcqs} videoId={videoId} autoStart />}
          {focusSession === 'cloze' && <VideoClozePanel key={focusKey} videoId={video.id} autoStart />}
          {focusSession === 'feynman' && <VideoFeynmanPanel key={focusKey} videoId={video.id} autoStart />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VideoStudyPanel;