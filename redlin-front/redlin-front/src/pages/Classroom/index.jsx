import { useEffect, useMemo, useRef, useState } from 'react';                                                                                               
  import { useNavigate, useParams } from 'react-router-dom';                                                                                                  
  import Box from '@mui/material/Box';                                                                                                                        
  import Button from '@mui/material/Button';                                                                                                                  
  import Chip from '@mui/material/Chip';                                                                                                                      
  import CircularProgress from '@mui/material/CircularProgress';                                                                                              
  import Divider from '@mui/material/Divider';                                                                                                                
  import Paper from '@mui/material/Paper';                                                                                                                    
  import Stack from '@mui/material/Stack';                                                                                                                    
  import TextField from '@mui/material/TextField';                                                                                                            
  import Typography from '@mui/material/Typography';
  import Tab from '@mui/material/Tab'; // You might need to import Tabs and Tab
  import Tabs from '@mui/material/Tabs';
  import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';                                                                                  
  import MicIcon from '@mui/icons-material/Mic';                                                                                                              
  import PauseCircleIcon from '@mui/icons-material/PauseCircle';                                                                                              
  import PlayArrowIcon from '@mui/icons-material/PlayArrow';                                                                                                  
  import RefreshIcon from '@mui/icons-material/Refresh';                                                                                                      
  import UploadFileIcon from '@mui/icons-material/UploadFile';                                                                                                
  import ReactMarkdown from 'react-markdown';                                                                                                                 
  import remarkGfm from 'remark-gfm';                                                                                                                         
  import { classroomService } from '../../services/api/classroom';                                                                                            
  import ClassroomQuiz from '../../components/Classroom/ClassroomQuiz';
  import ClassroomClozePanel from '../../components/Classroom/ClassroomClozePanel';
  import ClassroomFeynmanPanel from '../../components/Classroom/ClassroomFeynmanPanel';
  import './Classroom.css';
  import TranscriptionWorker from '../../workers/transcription.worker.js?worker';
                                                                                                                                                              
  const POLL_STATUSES = new Set(['recording', 'stopped', 'transcribing', 'ready', 'processing', 'failed']);                                                                        
                                                                                                                                                              
  const statusTone = (status) => {                                                                                                                            
    switch (status) {                                                                                                                                         
      case 'recording':                                                                                                                                       
        return 'error';                                                                                                                                     
      case 'transcribing':                                                                                                                                    
      case 'processing':                                                                                                                                      
        return 'warning';                                                                                                                                     
      case 'ready':                                                                                                                                           
        return 'info';                                                                                                                                        
      case 'completed':                                                                                                                                       
        return 'success';                                                                                                                                     
      case 'failed':                                                                                                                                          
        return 'error';                                                                                                                                       
      default:                                                                                                                                                
        return 'default';                                                                                                                                     
    }                                                                                                                                                         
  };                                                                                                                                                          
                                                                                                                                                              
  const Classroom = () => {                                                                                                                                   
    const { sessionId } = useParams();                                                                                                                        
    const navigate = useNavigate();                                                                                                                           
    const [session, setSession] = useState(null);                                                                                                           
    const [results, setResults] = useState(null);                                                                                                             
    const [loading, setLoading] = useState(true);                                                                                                             
    const [error, setError] = useState(null);                                                                                                                 
    const [recording, setRecording] = useState(false);                                                                                                        
    const [liveTranscript, setLiveTranscript] = useState('');                                                                                                 
    const [audioReady, setAudioReady] = useState(false);                                                                                                      
    const [uploading, setUploading] = useState(false);                                                                                                        
    const [processing, setProcessing] = useState(false);                                                                                                      
    const [manualTranscript, setManualTranscript] = useState('');                                                                                             
    const [mediaError, setMediaError] = useState('');

    const isCompleted = session?.status === 'completed';
    const storedTranscript = useMemo(() => {
      const transcript = results?.session?.transcript_text || session?.transcript_text || '';
      return typeof transcript === 'string' ? transcript.trim() : '';
    }, [results?.session?.transcript_text, session?.transcript_text]);
    const statusChipSx = {
      height: 24,
      '& .MuiChip-label': {
        px: 1,
      },
      '& .MuiChip-icon': {
        ml: 0.5,
        fontSize: 14,
      },
    };

    const [activeTab, setActiveTab] = useState(0);                                                                                                            
    const tabs = ['Summary', 'MCQs', 'Clozes', 'Feynman'];

    const mediaRecorderRef = useRef(null);                                                                                                                    
    const streamRef = useRef(null);                                                                                                                           
    const chunksRef = useRef([]);                                                                                                                             
    const pollRef = useRef(null);                                                                                                                             
    const recognitionRef = useRef(null);
    const [, setIsModelReady] = useState(false);
    const workersRef = useRef([]);
    const currentWorkerIndexRef = useRef(0)
    const isModelReadyRef = useRef(false);
    const audioBufferRef = useRef([]);
                                                                                                                                                              
    const canProcess = useMemo(() => Boolean(sessionId && audioReady && !recording && !uploading), [sessionId, audioReady, recording, uploading]);            
                                                                                                                                                              
    const stopStreamTracks = () => {                                                                                                                          
      if (streamRef.current) {                                                                                                                                
        streamRef.current.getTracks().forEach((track) => track.stop());                                                                                       
        streamRef.current = null;                                                                                                                           
      }                                                                                                                                                       
    };                                                                                                                                                        
                                                                                                                                                              
      const loadSession = async (id) => {           
        setLoading(true);                                                                                                                                     
        setError(null);                                                                                                                                       
        try {                                                                                                                                                 
          const data = await classroomService.getSessionStatus(id);                                                                                           
          console.log("Fetched session data:", data); // DEBUG LOG                                                                                            
          setSession(data);                                                                                                                                   
          if (data?.status === 'completed') {                                                                                                                 
            const full = await classroomService.getResults(id);                                                                                               
            setResults(full);                                                                                                                                 
          }                                                                                                                                                   
          if (typeof data?.transcript_text === 'string') {                                                                                                    
            setManualTranscript(data.transcript_text);                                                                                                        
          }                                                                                                                                                   
        } catch (err) {                                                                                                                                       
          setError(err?.response?.data?.detail || err?.message || 'Failed to load classroom session');                                                        
        } finally {                                                                                                                                           
          setLoading(false);                                                                                                                                  
        }                                                                                                                                                     
      };                                                                                                                                                    
                                                                                                                                                              
    useEffect(() => {                                                                                                                                         
      if (!sessionId) return undefined;                                                                                                                       
      let ignore = false;                                                                                                                                     
                                                                                                                                                              
      (async () => {                                                                                                                                          
        try {                                                                                                                                                 
          const data = await classroomService.getSessionStatus(sessionId);                                                                                    
          if (ignore) return;                                                                                                                                 
          setSession(data);                                                                                                                                   
          if (typeof data?.transcript_text === 'string') {                                                                                                    
            setManualTranscript(data.transcript_text);                                                                                                        
          }                                                                                                                                                   
          if (data?.status === 'completed') {                                                                                                                 
            const full = await classroomService.getResults(sessionId);                                                                                        
            if (!ignore) setResults(full);                                                                                                                    
          }                                                                                                                                                   
        } catch (err) {                                                                                                                                       
          if (!ignore) setError(err?.response?.data?.detail || err?.message || 'Failed to load classroom session');                                           
        } finally {                                                                                                                                           
          if (!ignore) setLoading(false);                                                                                                                     
        }                                                                                                                                                     
      })();                                                                                                                                                   
                                                                                                                                                              
      return () => {                                                                                                                                          
        ignore = true;                                                                                                                                        
      };                                                                                                                                                      
    }, [sessionId]);                                                                                                                                          
                                                                                                                                                              
    useEffect(() => {                                                                                                                                         
      if (!session?.status || !POLL_STATUSES.has(session.status)) {                                                                                           
        if (pollRef.current) {                                                                                                                                
          clearInterval(pollRef.current);                                                                                                                     
          pollRef.current = null;                                                                                                                             
        }                                                                                                                                                     
        return undefined;                                                                                                                                     
      }                                                                                                                                                       
                                                                                                                                                              
      if (pollRef.current) clearInterval(pollRef.current);                                                                                                    
      pollRef.current = window.setInterval(async () => {                                                                                                      
        try {                                                                                                                                                 
          const latest = await classroomService.getSessionStatus(sessionId);                                                                                  
          setSession(latest);                                                                                                                                 
          if (latest?.status === 'completed') {                                                                                                               
            const full = await classroomService.getResults(sessionId);                                                                                        
            setResults(full);                                                                                                                                 
            if (pollRef.current) {                                                                                                                            
              clearInterval(pollRef.current);                                                                                                                 
              pollRef.current = null;                                                                                                                         
            }                                                                                                                                                 
          }                                                                                                                                                   
        } catch {                                                                                                                                             
          // silent poll retry                                                                                                                                
        }                                                                                                                                                     
      }, 3500);                                                                                                                                               
                                                                                                                                                              
      return () => {                                                                                                                                          
        if (pollRef.current) {                                                                                                                                
          clearInterval(pollRef.current);                                                                                                                     
          pollRef.current = null;                                                                                                                             
        }                                                                                                                                                     
      };                                                                                                                                                      
    }, [session?.status, sessionId]);                                                                                                                         
                                                                                                                                                              
    useEffect(() => () => {                                                                                                                                   
      if (pollRef.current) clearInterval(pollRef.current);                                                                                                    
      stopStreamTracks();                                                                                                                                     
    }, []);                                                                                                                                                   
                                                                                                                                                              
    // 1. Add a ref for the worker at the top of the component                                                                                              
                                                                                                                                                              
      const startListening = async () => {                                      
        setMediaError('');                                                      
        setError(null);                                                         
        setLiveTranscript('');                                                  
        setIsModelReady(false);                                                 
        isModelReadyRef.current = false;                                        
                                                                                
        try {                                                                   
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true
   });                                                                          
          streamRef.current = stream;
          chunksRef.current = [];                                               
                                                                                
          // 1. Initialize WORKER POOL (3 Workers for Parallelism)
            const POOL_SIZE = 3;                                                
            const workers = [];                                                 
                                                                                
            console.log(`[Classroom] Initializing worker pool with ${POOL_SIZE} workers...`);                                                                 
                                                                                
            for (let i = 0; i < POOL_SIZE; i++) {                               
              try {
                const worker = new TranscriptionWorker();                       
                console.log(`[Classroom] Worker ${i} created successfully`);    
                                                                                
                worker.onmessage = (e) => {                                     
                  if (e.data.type === 'ready') {                                
                    console.log(`[Classroom] Worker ${i} reported READY`);      
                    if (i === 0) {                                              
                      isModelReadyRef.current = true;                           
                      setIsModelReady(true);                                    
                    }                                                           
                  } else if (e.data.type === 'result') {                        
                    setLiveTranscript(prev => prev + ' ' + e.data.text);        
                  } else if (e.data.type === 'error') {                         
                    console.error(`[Classroom] Worker ${i} reported ERROR:`, e.data.message);                                                              
                  }                                                             
                };                                                              
                  
                worker.postMessage({                                            
                  type: 'init',
                  language: session?.language || 'en'                           
                });                                                             
                                                                                
                workers.push(worker);                                           
              } catch (err) {
                console.error(`[Classroom] Failed to spawn worker ${i}:`, err); 
              }                                                                 
            }                                                                   

          workersRef.current = workers;                                         
                                                                                
          // 2. Use AudioContext for LIVE transcription                         
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });                            
          const source = audioCtx.createMediaStreamSource(stream);
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);         
                                                                                
          audioBufferRef.current = [];                                          
                                                                                
          processor.onaudioprocess = (e) => {                                   
            if (!isModelReadyRef.current || workersRef.current.length === 0)
  return;                                                                       
                  
            const inputData = e.inputBuffer.getChannelData(0);                  
                  
            // Volume Check (VAD)                                               
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {                        
              sum += inputData[i] * inputData[i];                               
            }                                                                   
            const rms = Math.sqrt(sum / inputData.length);                      
            if (rms < 0.01) return;                                             
                                                                                
            if (!audioBufferRef.current) audioBufferRef.current = [];           
            audioBufferRef.current.push(new Float32Array(inputData));           
                                                                                
            // Buffer window: 6 chunks (~1.5s)                                  
            if (audioBufferRef.current.length >= 6) {                           
              const totalLength = audioBufferRef.current.reduce((acc, chunk) => acc + chunk.length, 0);                                                       
              const finalAudio = new Float32Array(totalLength);                 
              let offset = 0;                                                   
              for (const chunk of audioBufferRef.current) {                     
                finalAudio.set(chunk, offset);                                  
                offset += chunk.length;                                         
              }                                                                 
                                                                                
              // --- PARALLEL ROTATION ---                                      
              // Pick the next worker in the pool                               
              const workerIdx = currentWorkerIndexRef.current;                  
              const worker = workersRef.current[workerIdx];                     
                                                                                
              worker.postMessage({                                              
                type: 'transcribe',                                             
                audio: finalAudio,                                              
                language: session?.language || 'en'                             
              });                                                               
                                                                                
              // Move to next worker for the next segment                       
              currentWorkerIndexRef.current = (workerIdx + 1) % POOL_SIZE;      
                                                                                
              audioBufferRef.current = [];                                      
            }                                                                   
          };                                                                    
                                                                                
          source.connect(processor);                                            
          processor.connect(audioCtx.destination);                              
                                                                                
          // 3. Keep MediaRecorder for final upload                             
          const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });                                                  
          mediaRecorderRef.current = recorder;
                                                                                
          recorder.ondataavailable = async (event) => {                         
            if (event.data && event.data.size > 0) {                            
              chunksRef.current.push(event.data);                               
            }                                                                   
          };                                                                    
                                                                                
          recorder.onstop = async () => {                                       
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });   
            stopStreamTracks();                                                 
            if (!blob.size) {                                                   
              setAudioReady(false);                                             
              return;                                                           
            }                                                                   
            setUploading(true);                                                 
            try {                                                               
              const file = new File([blob], `classroom-${sessionId || 'session'}.webm`, { type: 'audio/webm' });                                    
              await classroomService.uploadAudio(sessionId, file);              
              setAudioReady(true);                                              
              await loadSession(sessionId);                                     
            } catch (err) {                                                     
              setError(err?.response?.data?.detail || err?.message || 'Failed to upload audio');
            } finally {                                                         
              setUploading(false);                                              
            }                                                                   
          };                                                                    
                                                                                
          recorder.start();                                                     
          setRecording(true);                                                   
          setAudioReady(false);                                                 
          setResults(null);                                                     
                                                                                
        } catch (err) {                                                         
          console.error("Microphone access error:", err);                       
          setMediaError(err?.message || 'Microphone access is required to record the class');
        }                                                                       
      }; 
      
      const stopListening = async () => {                                                                                                                     
        console.log("Stop listening clicked. SessionID:", sessionId); // DEBUG LOG                                                                            
        const recorder = mediaRecorderRef.current;                                                                                                            
        if (!recorder || recorder.state === 'inactive') {                                                                                                     
          console.warn("No active recorder found to stop");                                                                                                   
        } else {                                                                                                                                              
          recorder.stop();                                                                                                                                    
        }                                                                                                                                                     
        
        if (workersRef.current && workersRef.current.length > 0) {            
            workersRef.current.forEach(worker => worker.terminate());           
            workersRef.current = [];                                            
          }                                                                                                                                                    
        setRecording(false);                                                                                                                                  
                                                                                                                                                              
        try {                                                                                                                                                 
          if (sessionId) {                                                                                                                                    
            console.log("Calling stopSession API...");                                                                                                        
            await classroomService.stopSession(sessionId);                                                                                                    
            console.log("Session stopped successfully on server");                                                                                            
            // Refresh session data immediately after stopping                     
            await loadSession(sessionId);                                                                                                                     
          } else {                                                                 
            console.error("Cannot stop session: sessionId is missing");                                                                                       
          }                                                                                                                                                   
        } catch (err) {                                                                                                                                       
          console.error('Failed to stop session on server:', err);                                                                                            
        }                                                                                                                                                     
                                                                                                                                                              
        if (pollRef.current) {                                                                                                                                
          clearInterval(pollRef.current);                                                                                                                     
          pollRef.current = null;                                                                                                                             
        }                                                                                                                                                     
        if (recognitionRef.current) {                                                                                                                         
          recognitionRef.current.stop();                                                                                                                      
          recognitionRef.current = null;                                                                                                                      
        }                                                                                                                                                     
      };                                                                                                                                                
                                                                                                                                                              
    const processTranscript = async () => {                                                                                                                   
      if (!sessionId) return;                                                                                                                                 
      setProcessing(true);                                                                                                                                    
      setError(null);                                                                                                                                         
      try {                                                                                                                                                   
        await classroomService.finishSession(sessionId, manualTranscript.trim());                                                                             
        await loadSession(sessionId);                                                                                                                         
      } catch (err) {                                                                                                                                         
        setError(err?.response?.data?.detail || err?.message || 'Failed to queue transcription');                                                             
      } finally {                                                                                                                                             
        setProcessing(false);                                                                                                                                 
      }                                                                                                                                                       
    };                                                                                                                                                        
                                                                                                                                                              
    const refreshResults = async () => {                                                                                                                      
      try {                                                                                                                                                   
        await loadSession(sessionId);                                                                                                                         
        const full = await classroomService.getResults(sessionId);                                                                                            
        setResults(full);                                                                                                                                     
      } catch (err) {                                                                                                                                         
        setError(err?.response?.data?.detail || err?.message || 'Failed to refresh session');                                                                 
      }                                                                                                                                                       
    };                                                                                                                                                        
                                                                                                                                                              
    if (loading) {                                                                                                                                            
      return (                                                                                                                                                
        <Box sx={{ width: '100%', display: 'grid', placeItems: 'center', minHeight: '100vh' }}>                                                               
          <Stack alignItems="center" spacing={2}>                                                                                                             
            <CircularProgress />                                                                                                                              
            <Typography variant="body2">Loading classroom space...</Typography>                                                                               
          </Stack>                                                                                                                                            
        </Box>                                                                                                                                                
      );                                                                                                                                                      
    }                                                                                                                                                         
                                                                                                                                                              
    if (error && !session) {                                                                                                                                  
      return (                                                                                                                                                
        <Box sx={{ p: 4 }}>                                                                                                                                   
          <Typography color="error.main" variant="h6">{error}</Typography>                                                                                    
          <Button sx={{ mt: 2 }} variant="contained" onClick={() => navigate('/home')}>                                                                       
            Back to Home                                                                                                                                      
          </Button>                                                                                                                                           
        </Box>                                                                                                                                                
      );                                                                                                                                                      
    }                                                                                                                                                         
                                                                                                                                                              
   return (                                                                                                                                                  
      <div className="classroom-root">                                                                                                                        
        <div className="classroom-mesh classroom-mesh-top" />                                                                                                 
        <div className="classroom-mesh classroom-mesh-bottom" />                                                                                              
        <div className="classroom-shell">                                                                                                                     
          <div className="classroom-hero">                                                                                                                    
            <div>                                                                                                                                             
              {/* <Chip label={`Session ${session?.id || sessionId}`} color={statusTone(session?.status)} sx={{ mb: 2 }} />                                        */}
              <Typography variant="h3" className="classroom-title">{session?.title || 'Classroom space'}</Typography>                                         
              <Typography variant="body1" className="classroom-subtitle">                                                                                     
                Record the lecture audio, stop when the class ends, then queue the transcription pipeline.                                                    
              </Typography>                                                                                                                                   
            </div>                                                                                                                                            
              {!isCompleted && (
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">                                                                           
              {/* <Button variant="outlined" onClick={() => navigate('/home')} sx={{ borderRadius: 999 }}>Exit</Button>                                            */}
              <Button                                                                                                                                         
                variant="contained"                                                                                                                           
                startIcon={recording ? <PauseCircleIcon /> : <MicIcon />}                                                                                     
                onClick={recording ? stopListening : startListening}                                                                                          
                sx={{ borderRadius: 999 }}                                                                                                                    
              >                                                                                                                                               
                {recording ? 'Stop listening' : 'Start listening'}                                                                                            
              </Button>                                                                                                                                       
              <Button                                                                                                                                         
                variant="contained"                                                                                                                           
                color="secondary"                                                                                                                             
                startIcon={<PlayArrowIcon />}                                                                                                                 
                onClick={processTranscript}                                                                                                                   
                disabled={!canProcess || processing}                                                                                                          
                sx={{ borderRadius: 999 }}                                                                                                                    
              >                                                                                                                                               
                {processing ? 'Processing...' : 'Process transcription'}                                                                                      
              </Button>                                                                                                                                       
              </Stack>
              )}
          </div>                                                                                                                                              
                                                                                                                                                              
          <div className="classroom-grid">                                                                                                                    
            <Paper className={`classroom-card classroom-card-console ${isCompleted ? 'classroom-card-console-completed' : ''}`} elevation={0}>           
              <div className="classroom-card-header">                                                                                                         
                <div>                                                                                                                                         
                  <Typography variant="overline" sx={{ letterSpacing: 3, color: 'rgba(255,255,255,0.55)' }}>{isCompleted ? 'Completed session' : 'Recording console'}</Typography>
                  <Typography variant="h5" sx={{ color: '#fff', mt: 0.5 }}>{isCompleted ? 'Stored transcript' : 'Capture lecture audio'}</Typography>
                </div>                                                                                                                                        
                {isCompleted ? (
                <Chip label="Completed" color={statusTone(session?.status)} size="small" sx={statusChipSx} />
                ) : (
                <Chip icon={recording ? <FiberManualRecordIcon /> : undefined} label={recording ? 'Live' : session?.status || 'Idle'}
  color={statusTone(session?.status)} size="small" sx={statusChipSx} />
                )}                                                                                                                      
              </div>                                                                                                                                          
              {isCompleted ? (
                <Box sx={{ mt: 2, p: 2.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>Transcription</Typography>
                  <Typography variant="body1" sx={{ color: '#fff', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                    {storedTranscript || 'No transcript available.'}
                  </Typography>
                </Box>
              ) : (
                <>
              <div className="classroom-wave" data-active={recording ? 'true' : 'false'}>                                                                     
                {[0, 1, 2, 3, 4, 5].map((bar) => (<span key={bar} style={{ animationDelay: `${bar * 120}ms` }} />))}                                          
              </div>                                                                                                                                          
              {recording && (                                                                                                                                 
                <Box sx={{ mt: 2, mb: 2, p: 2, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)' }}>              
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mb: 1 }}>Live Captions:</Typography>                  
                  <Typography variant="body2" sx={{ color: '#fff', fontStyle: 'italic' }}>{liveTranscript || 'Listening...'}</Typography>                     
                </Box>                                                                                                                                         
              )}                                                                                                                                              
              <Stack spacing={1.5} sx={{ mt: 3 }}>                                                                                                            
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)' }}>                                                                         
                  {recording ? 'Your browser is listening now. Stop when the professor finishes speaking.' : audioReady ? 'Audio uploaded. Press Process transcription to start STT and content generation.' : 'Press Start listening to begin capturing the class audio.'}                                          
                </Typography>                                                                                                                                 
                {mediaError && <Typography variant="body2" color="error.main">{mediaError}</Typography>}                                                      
                {session?.status === 'failed' && <Typography variant="body2" color="error.main" sx={{ fontWeight: 'bold' }}>Error: {session.error_message ||  
  'Transcription failed.'}</Typography>}                                                                                                                      
                {error && <Typography variant="body2" color="error.main">{error}</Typography>}                                                                
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />                                                                                    
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">                                                                                
                  <Chip label={`Language: ${session?.language || 'es'}`} variant="outlined" sx={{ color: '#fff' }} />                                         
                  <Chip label={`Uploaded: ${audioReady ? 'Yes' : 'No'}`} variant="outlined" sx={{ color: '#fff' }} />                                         
                  <Chip label={`Status: ${session?.status || 'unknown'}`} variant="outlined" sx={{ color: '#fff' }} />                                        
                </Stack>                                                                                                                                      
              </Stack>                                                                                                                                         
              <Stack direction="row" spacing={1.5} sx={{ mt: 4, flexWrap: 'wrap' }}>                                                                          
                <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={refreshResults} sx={{ borderRadius: 999 }}>Refresh</Button>                
                <Button variant="contained" onClick={processTranscript} disabled={!canProcess || processing} sx={{ borderRadius: 999 }}>{processing ?         
  'Queueing...' : 'Queue transcription'}</Button>                                                                                                             
              </Stack>                                                                                                                                         
                </>
              )}
            </Paper>                                                                                                                                          
                                                                                                                                                              
            <Paper className="classroom-card classroom-card-output" elevation={0}>                                                                           
              <div className="classroom-card-header">                                                                                                         
                <div>                                                                                                                                         
                  <Typography variant="overline" sx={{ letterSpacing: 3, color: 'rgba(255,255,255,0.55)' }}>Generated study space</Typography>                
                  <Typography variant="h5" sx={{ color: '#fff', mt: 0.5 }}>Transcript and Learning Materials</Typography>                                     
                </div>                                                                                                                                        
                <Button size="small" variant="outlined" onClick={refreshResults} sx={{ borderRadius: 999 }}><RefreshIcon fontSize="small" /></Button>         
              </div>                                                                                                                                          
                                                                                                                                                              
              <div className="classroom-output-stack">                                                                                                        
                {!isCompleted && <div className="classroom-output-block">                                                                                     
                  <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>Transcript</Typography>                                      
                  <TextField                                                                                                                                  
                    value={manualTranscript}                                                                                                                  
                    onChange={(event) => setManualTranscript(event.target.value)}                                                                             
                    placeholder="Optional manual transcript fallback if the recording is not usable."                                                         
                    minRows={6} multiline fullWidth variant="outlined"                                                                                        
                    sx={{ '& .MuiInputBase-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' } }}       
                  />                                                                                                                                          
                </div>}                                                                                                                                       
                                                                                                                                                              
                <Box sx={{ mt: 3, borderBottom: 1, borderColor: 'rgba(255,255,255,0.1)' }}>                                                                   
                  <Tabs                                                                                                                                       
                    value={activeTab}                                                                                                                         
                    onChange={(e, newVal) => setActiveTab(newVal)}                                                                                            
                    textColor="#fff"                                                                                                                          
                    indicatorColor="primary"                                                                                                                  
                    sx={{ '& .MuiTab-root': { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 500 } }}                                              
                  >                                                                                                                                           
                    {tabs.map((tab, index) => <Tab key={tab} label={tab} sx={{ color: activeTab === index ? '#fff' : 'rgba(255,255,255,0.6)' }} />)}          
                  </Tabs>                                                                                                                                     
                </Box>                                                                                                                                        
                                                                                                                                                              
                <div className="classroom-tab-content" style={{ mt: 2 }}>                                                                                     
                  {results ? (                                                                                                                                
                    <>                                                                                                                                        
                      {activeTab === 0 && (                                                                                                                   
                        <div className="classroom-output-block">                                                                                              
                          <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>Summary</Typography>                                 
                          <div className="classroom-markdown">                                                                                                
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{results.summary?.content || 'No summary available.'}</ReactMarkdown>                  
                          </div>                                                                                                                              
                        </div>                 
                      )}                                                                                                                                      
                      {activeTab === 1 && (                                                                                                                   
                        <div className="classroom-output-block">                                                                                              
                          <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>MCQs ({results.mcqs?.length || 0})</Typography>      
                          <ClassroomQuiz mcqs={results.mcqs} />
                        </div>                                                                                                                                
                      )}                                                                                                                                      
                      {activeTab === 2 && (                                                                                                                   
                        <div className="classroom-output-block">                                                                                              
                          <ClassroomClozePanel clozes={results.clozes} />
                        </div>                                                                                                                                
                      )}                                                                                                                                      
                      {activeTab === 3 && (                                                                                                                   
                        <div className="classroom-output-block">                                                                                              
                          <ClassroomFeynmanPanel sessionId={session.id} prompts={results.feynmans} />
                        </div>                                                                                                                                
                      )}                                                                                                                                      
                    </>                                                                                                                                       
                  ) : (                                                                                                                                       
                    <div className="classroom-empty-state">                                                                                                   
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)' }}>                                                                   
                        {session?.status === 'completed' ? 'No materials found.' : 'Once transcription completes, the summary and learning items will appear  here.'}                                                                                                                                                     
                      </Typography>                                                                                                                           
                    </div>                                                                                                                                    
                  )}                                                                                                                                          
                </div>                                                                                                                                        
              </div>                                                                                                                                          
            </Paper>                                                                                                                                          
          </div>                                                                                                                                              
        </div>                                                                                                                                                
      </div>                                                                                                                                                  
    );                                                                                                                                                        
  };                                                                                                                                                          
                                                                                                                                                              
export default Classroom;      