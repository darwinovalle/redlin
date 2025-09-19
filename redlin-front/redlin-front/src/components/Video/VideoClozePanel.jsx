import React, { useCallback, useEffect, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import GearSvg from '../../assets/Gear@1x-0.2s-200px-200px (1).svg';
import { clozeService } from '../../services/api/cloze.jsx';
import VideoClozeCard from './VideoClozeCard';

/**
 * VideoClozePanel handles listing & practice flow for video clozes.
 * Props: videoId
 */
const VideoClozePanel = ({ videoId }) => {
  const [clozes, setClozes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [started, setStarted] = useState(false);
  const [sessionKey, setSessionKey] = useState(null);
  const [answeredMap, setAnsweredMap] = useState({});

  const shuffle = useCallback((arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, []);

  const load = useCallback(async () => {
    if (!videoId) { setClozes([]); return; }
    setLoading(true); setError(null);
    try {
      const data = await clozeService.listVideoClozes(videoId);
      setClozes(data || []);
    } catch (e) {
      setError(e?.detail || e?.error || 'Failed to load clozes');
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setStarted(false); }, [videoId]);
  useEffect(() => { setAnsweredMap({}); }, [sessionKey]);

  const handleValidate = async ({ clozeId, answer }) => {
    return clozeService.validate({ clozeId, answer, type: 'video' });
  };

  if (!videoId) {
    return <Box sx={{ p:3, display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><Typography color="text.secondary">Select a video to practice clozes.</Typography></Box>;
  }

  if (loading) {
    return <Box sx={{ p:3, display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><img src={GearSvg} alt="Loading" width={30} height={30} /><Typography sx={{ ml:2 }}>Loading Clozes...</Typography></Box>;
  }

  if (error) {
    return <Box sx={{ p:3, display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><Typography color="error">Error: {error}</Typography></Box>;
  }

  if (!clozes || clozes.length === 0) {
    return <Box sx={{ p:3, textAlign:'center' }}><Typography color="text.secondary" sx={{ maxWidth:480 }}>This video doesn't have Cloze exercises enabled yet.</Typography></Box>;
  }

  if (!started) {
    return (
      <Box sx={{ p:4, height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', textAlign:'center', width:'100%', maxWidth:640, mx:'auto' }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight:'bold' }} color="black">Cloze Practice</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb:3, maxWidth:520 }}>Ready? This set contains {clozes.length} cloze {clozes.length===1?'item':'items'}. Fill in the blanks accurately. Click start when you're ready.</Typography>
        <Button variant="contained" size="large" onClick={() => { setClozes(prev => shuffle(prev)); setSessionKey(Date.now()); setStarted(true); }} sx={{ backgroundColor:'#000', borderRadius:'20px' }}>Start Cloze Practice</Button>
      </Box>
    );
  }

  const total = clozes.length;
  const answeredIds = Object.keys(answeredMap);
  const answeredCount = answeredIds.length;
  const correctCount = answeredIds.reduce((acc, id) => acc + (answeredMap[id] ? 1 : 0), 0);

  if (answeredCount === total) {
    return (
      <Box sx={{ p:4, height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', textAlign:'center' }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight:'bold' }} color="black">Results</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb:3 }}>Score: {correctCount} / {total}</Typography>
        <Button variant="contained" onClick={() => { setStarted(false); setSessionKey(Date.now()); }} sx={{ backgroundColor:'#6be0a6', borderRadius:'20px' }}>Exit</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p:2, height:'100%', overflowY:'auto' }}>
      <Box sx={{ mb:1, px:1, fontSize:12, color:'text.secondary' }}>Progress: {answeredCount} / {total}</Box>
      {clozes.map(c => (
        <VideoClozeCard
          key={c.id}
          cloze={c}
          onValidate={handleValidate}
          sessionKey={sessionKey}
          onResult={({ clozeId, correct }) => setAnsweredMap(prev => prev[clozeId] == null ? { ...prev, [clozeId]: correct } : prev)}
        />
      ))}
    </Box>
  );
};

export default VideoClozePanel;
