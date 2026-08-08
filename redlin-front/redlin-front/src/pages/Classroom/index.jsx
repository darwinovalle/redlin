import { useEffect, useMemo, useRef, useState } from 'react';
  import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
  import { useStudySession } from '../../hooks/useStudySession';
  import StudyTimerBadge from '../../components/common/StudyTimerBadge';
  import CaptureAudioModal from '../../components/Classroom/CaptureAudioModal';                                                                                                  
  import Box from '@mui/material/Box';                                                                                                                        
  import Button from '@mui/material/Button';                                                                                                                  
  import Chip from '@mui/material/Chip';                                                                                                                      
  import CircularProgress from '@mui/material/CircularProgress';                                                                                              
  import Divider from '@mui/material/Divider';                                                                                                                
  import Paper from '@mui/material/Paper';                                                                                                                    
  import Stack from '@mui/material/Stack';
  import LinearProgress from '@mui/material/LinearProgress';
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
  import DescriptionIcon from '@mui/icons-material/Description';
  import CloseIcon from '@mui/icons-material/Close';
  import IconButton from '@mui/material/IconButton';
  import Dialog from '@mui/material/Dialog';
  import DialogContent from '@mui/material/DialogContent';
  import Switch from '@mui/material/Switch';
  import LockIcon from '@mui/icons-material/Lock';
  import LockOpenIcon from '@mui/icons-material/LockOpen';
  import OpenInFullIcon from '@mui/icons-material/OpenInFull';
  import ReactMarkdown from 'react-markdown';
  import remarkGfm from 'remark-gfm';                                                                                                                         
  import { classroomService } from '../../services/api/classroom';                                                                                            
  import ClassroomQuiz from '../../components/Classroom/ClassroomQuiz';
  import ClassroomClozePanel from '../../components/Classroom/ClassroomClozePanel';
  import ClassroomFeynmanPanel from '../../components/Classroom/ClassroomFeynmanPanel';
  import './Classroom.css';
  import TranscriptionWorker from '../../workers/transcription.worker.js?worker';
                                                                                                                                                              
  // Poll only while the server is actively working (async transcription or
  // content generation) so we can surface results when they're ready. Idle
  // states (new / recording / stopped / failed / completed) do NOT poll — a
  // space that's simply open, or where capture never actually started, costs
  // zero requests. This was the source of the constant GET /status/ flood.
  const POLL_STATUSES = new Set(['transcribing', 'ready', 'processing']);

  // Firefox does not support audio in screen/tab share capture, so it must
  // fall back to the microphone. Chrome/Edge offer tab audio via the picker.
  const isFirefox = typeof navigator !== 'undefined' && /Firefox\//i.test(navigator.userAgent);

  // Whisper expects 16 kHz. The mic/display stream may run at the device's
  // native rate, so resample before handing audio to the worker.
  const resampleAudio = (input, fromRate, toRate = 16000) => {
    if (fromRate === toRate || !input || input.length === 0) return input;
    const ratio = toRate / fromRate;
    const output = new Float32Array(Math.max(1, Math.floor(input.length * ratio)));
    for (let i = 0; i < output.length; i += 1) {
      const pos = i / ratio;
      const i0 = Math.floor(pos);
      const i1 = Math.min(i0 + 1, input.length - 1);
      const frac = pos - i0;
      output[i] = input[i0] * (1 - frac) + input[i1] * frac;
    }
    return output;
  };                                                                        
                                                                                                                                                              
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
    // Auto-record study time while this lecture study page stays open.
    const studyElapsed = useStudySession({ model: 'lecture', itemId: sessionId });                                                                                                                        
    const navigate = useNavigate();                                                                                                                           
    const [session, setSession] = useState(null);
    const [results, setResults] = useState(null);
    const [captureInfoOpen, setCaptureInfoOpen] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);                                                                                                             
    const [error, setError] = useState(null);                                                                                                                 
    const [recording, setRecording] = useState(false);                                                                                                        
    const [liveTranscript, setLiveTranscript] = useState('');                                                                                                 
    const [audioReady, setAudioReady] = useState(false);                                                                                                      
    const [uploading, setUploading] = useState(false);                                                                                                        
    const [processing, setProcessing] = useState(false);                                                                                                      
    const [manualTranscript, setManualTranscript] = useState('');
    const [mediaError, setMediaError] = useState('');
    const [captureMode, setCaptureMode] = useState(null); // 'tab' | 'mic' | null
    const [tabVisible, setTabVisible] = useState(true);
    const [silenceDialogOpen, setSilenceDialogOpen] = useState(false);
    // Focus Mode: tests open fullscreen so the student can't peek at the
    // transcript/summary. Persisted; defaults to ON.
    const [focusMode, setFocusMode] = useState(() => {
      try {
        const stored = localStorage.getItem('classroom:focusMode');
        return stored === null ? true : stored === '1';
      } catch {
        return true;
      }
    });
    const [focusSession, setFocusSession] = useState(null); // 'mcq' | 'cloze' | 'feynman' | null
    const [focusKey, setFocusKey] = useState(0);

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
    const [transcriptOpen, setTranscriptOpen] = useState(false);
    const [summaryOpen, setSummaryOpen] = useState(false);
    const tabs = ['MCQs', 'Clozes', 'Feynman'];

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
    const lastVoicedAtRef = useRef(Date.now());
    const silenceTimerRef = useRef(null);
    const recordingRef = useRef(false);
                                                                                                                                                              
    const canProcess = useMemo(() => Boolean(sessionId && audioReady && !recording && !uploading), [sessionId, audioReady, recording, uploading]);            
                                                                                                                                                              
    const stopStreamTracks = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };

    const SILENCE_TIMEOUT_MS = 60000; // 1 minute with no audio stops capture
    const VOICED_RMS = 0.01; // same threshold as the VAD gate below

    const stopSilenceWatch = () => {
      if (silenceTimerRef.current) { clearInterval(silenceTimerRef.current); silenceTimerRef.current = null; }
    };

    // Watchdog: if no voice is detected for SILENCE_TIMEOUT_MS, auto-stop so an
    // accidentally-left-on recording doesn't run forever or upload noise.
    const startSilenceWatch = () => {
      stopSilenceWatch();
      silenceTimerRef.current = window.setInterval(() => {
        if (!recordingRef.current) { stopSilenceWatch(); return; }
        if (Date.now() - lastVoicedAtRef.current >= SILENCE_TIMEOUT_MS) {
          // clear first so a single silence can't double-fire the stop
          stopSilenceWatch();
          stopCapture({ auto: true });
        }
      }, 2000);
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
          if (typeof data?.transcript_text === 'string' && data.transcript_text.length > 0) {
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
          // Fresh space: never carry over a previous space's transcript or study results.
          setManualTranscript('');
          setResults(null);
          setActiveTab(0);
          const data = await classroomService.getSessionStatus(sessionId);
          if (ignore) return;
          setSession(data);
          if (typeof data?.transcript_text === 'string' && data.transcript_text.length > 0) {
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
                                                                                                                                                              
    // Show the capture-audio help the first time a user creates a space.
    useEffect(() => {
      if (searchParams.get('captureHelp') === '1') {
        setCaptureInfoOpen(true);
        setSearchParams({}, { replace: true });
      }
    }, [searchParams, setSearchParams]);

    // Track whether the tab is visible so background tabs don't keep polling.
    useEffect(() => {
      const update = () => setTabVisible(document.visibilityState === 'visible');
      document.addEventListener('visibilitychange', update);
      return () => document.removeEventListener('visibilitychange', update);
    }, []);

    // Persist the focus-mode preference across reloads.
    useEffect(() => {
      try { localStorage.setItem('classroom:focusMode', focusMode ? '1' : '0'); } catch {}
    }, [focusMode]);

    const openFocus = (type) => { setFocusKey((k) => k + 1); setFocusSession(type); };

    useEffect(() => {
      // Only poll while the server is working on this session AND the tab is in
      // view. If the tab is hidden or the session is idle, tear down the poll so
      // we send zero requests on background/idle views.
      const serverWorking = Boolean(session?.status) && POLL_STATUSES.has(session.status);
      if (!serverWorking || !tabVisible) {
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
            // Reload so the sidebar (and everything else) reflects the fresh
            // "completed" status without a manual refresh.
            window.setTimeout(() => window.location.reload(), 400);
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
    }, [session?.status, sessionId, tabVisible]);                                                                                                                         
                                                                                                                                                              
    useEffect(() => () => {
      stopSilenceWatch();
      if (pollRef.current) clearInterval(pollRef.current);
      stopStreamTracks();
      recordingRef.current = false;
    }, []);                                                                                                                                                   
                                                                                                                                                              
    // 1. Add a ref for the worker at the top of the component                                                                                              
                                                                                                                                                              
      const startListening = async () => {                                      
        setMediaError('');
        setError(null);
        setLiveTranscript('');
        setIsModelReady(false);
        isModelReadyRef.current = false;
        setSilenceDialogOpen(false);
        lastVoicedAtRef.current = Date.now();                                        
                                                                                
        try {
          // Firefox cannot capture tab/screen audio, so it records via the
          // microphone instead. Chrome/Edge share a tab/window/screen and keep
          // only the audio (video is discarded).
          const stream = isFirefox
            ? await navigator.mediaDevices.getUserMedia({ audio: true })
            : await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
          if (!isFirefox) {
            stream.getVideoTracks().forEach((track) => { try { track.stop(); } catch {} });
          }
          setCaptureMode(isFirefox ? 'mic' : 'tab');
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
                                                                                
          // 2. Use AudioContext for LIVE transcription. Let the context use its
          // native sample rate (Firefox rejects forcing a rate that differs
          // from the captured stream) and resample to 16k for the worker.
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const source = audioCtx.createMediaStreamSource(stream);
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);         
                                                                                
          audioBufferRef.current = [];                                          
                                                                                
          processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);

            // Volume check (VAD) + silence tracking. Run this before the
            // model-ready gate so the silence watchdog keeps counting even
            // while the whisper model is still loading.
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
              sum += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sum / inputData.length);
            const voiced = rms >= VOICED_RMS;
            if (voiced) lastVoicedAtRef.current = Date.now();

            if (!isModelReadyRef.current || workersRef.current.length === 0) return;
            if (!voiced) return;

            if (!audioBufferRef.current) audioBufferRef.current = [];
            audioBufferRef.current.push(new Float32Array(inputData));

            // Buffer by duration (~1.5s of audio at the actual stream rate),
            // then resample to 16 kHz for whisper. Fixed chunk counts break
            // once the AudioContext runs at the device's native rate.
            const targetSamples = Math.round(audioCtx.sampleRate * 1.5);
            const bufferedSamples = audioBufferRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
            if (bufferedSamples >= targetSamples) {
              const finalAudio = new Float32Array(bufferedSamples);
              let offset = 0;
              for (const chunk of audioBufferRef.current) {
                finalAudio.set(chunk, offset);
                offset += chunk.length;
              }

              // --- PARALLEL ROTATION ---
              // Pick the next worker in the pool
              const workerIdx = currentWorkerIndexRef.current;
              const worker = workersRef.current[workerIdx];
              // whisper needs 16 kHz regardless of the captured stream rate
              const modelAudio = resampleAudio(finalAudio, audioCtx.sampleRate, 16000);

              worker.postMessage({
                type: 'transcribe',
                audio: modelAudio,
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
          recordingRef.current = true;
          setAudioReady(false);
          setResults(null);
          startSilenceWatch();                                                     
                                                                                
        } catch (err) {                                                         
          console.error("Microphone access error:", err);                       
          setMediaError(err?.message || 'Microphone access is required to record the class');
        }                                                                       
      }; 
      
      const stopCapture = async ({ auto = false } = {}) => {
        stopSilenceWatch();
        recordingRef.current = false;
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
        setCaptureMode(null);

        try {
          if (sessionId) {
            await classroomService.stopSession(sessionId);
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

        // Let the user decide what to do with whatever was captured.
        if (auto) setSilenceDialogOpen(true);
      };

      const stopListening = () => stopCapture({ auto: false });                                                                                                                                                
                                                                                                                                                              
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
        <Box sx={{ position: 'absolute', top: 24, right: 32, zIndex: 5 }}><StudyTimerBadge seconds={studyElapsed} /></Box>
        <div className="classroom-shell">
          <div className="classroom-grid">
            <div className="classroom-column">
              <div className="classroom-hero">
            <div>
              <Typography variant="h3" className="classroom-title">{session?.title || 'Classroom space'}</Typography>
              <Typography variant="body1" className="classroom-subtitle">
                Share the meeting tab, window or screen to capture the speaker's voice; stop when the class ends, then queue the transcription pipeline.
              </Typography>
            </div>                                                                                                                                            
              {!isCompleted && (
              <Stack
                direction="row"
                spacing={3}
                alignItems="center"
                flexWrap="nowrap"
                sx={{ width: '100%', justifyContent: 'center' }}
              >
              <Button
                variant="contained"
                startIcon={recording ? <PauseCircleIcon /> : <MicIcon />}
                onClick={recording ? stopListening : startListening}
                sx={{
                  flex: '1 1 0',
                  minWidth: 0,
                  maxWidth: 230,
                  px: 3,
                  py: 1.4,
                  borderRadius: '999px',
                  backgroundColor: 'var(--color-teal)',
                  color: 'var(--color-navy-deep)',
                  fontWeight: 700,
                  fontSize: 15,
                  letterSpacing: '0.01em',
                  textTransform: 'none',
                  boxShadow: '0 10px 28px color-mix(in srgb, var(--color-teal) 30%, transparent)',
                  '&:hover': { backgroundColor: 'var(--color-teal-pale)' },
                }}
              >
                {recording ? 'Stop capturing' : 'Capture audio'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<PlayArrowIcon />}
                onClick={processTranscript}
                disabled={!canProcess || processing}
                sx={{
                  flex: '1 1 0',
                  minWidth: 0,
                  maxWidth: 230,
                  px: 3,
                  py: 1.4,
                  borderRadius: '999px',
                  borderColor: 'color-mix(in srgb, var(--color-white) 22%, transparent)',
                  color: 'var(--color-white)',
                  fontWeight: 700,
                  fontSize: 15,
                  letterSpacing: '0.01em',
                  textTransform: 'none',
                  '&:hover': { borderColor: 'var(--color-teal)', backgroundColor: 'color-mix(in srgb, var(--color-teal) 10%, transparent)', color: 'var(--color-white)' },
                  '&.Mui-disabled': { borderColor: 'color-mix(in srgb, var(--color-white) 12%, transparent)', color: 'color-mix(in srgb, var(--color-white) 40%, transparent)' },
                }}
              >
                {processing ? 'Processing…' : 'Process'}
              </Button>
              </Stack>
              )}
          </div>

            <Paper className={`classroom-card classroom-card-console ${isCompleted ? 'classroom-card-console-completed' : ''}`} elevation={0}>
              <div className="classroom-card-header">
                <div>
                  <Typography variant="overline" sx={{ letterSpacing: 3, color: 'color-mix(in srgb, var(--color-white) 55%, transparent)' }}>{isCompleted ? 'Completed session' : 'Recording console'}</Typography>
                  <Typography variant="h5" sx={{ color: 'var(--color-white)', mt: 0.5 }}>{isCompleted ? 'Summary' : 'Capture audio'}</Typography>
                </div>
                {isCompleted ? (
                <Chip label="Completed" color={statusTone(session?.status)} size="small" sx={statusChipSx} />
                ) : (
                <Stack direction="row" spacing={1.5} alignItems="center">
                  {/* Thin bar that signals the server is still transcribing/generating */}
                  {POLL_STATUSES.has(session?.status) && (
                    <Box sx={{ width: 90 }}>
                      <LinearProgress color="primary" sx={{ height: 3, borderRadius: 999, '& .MuiLinearProgress-bar': { borderRadius: 999 } }} />
                    </Box>
                  )}
                  <Chip icon={recording ? <FiberManualRecordIcon /> : undefined} label={recording ? 'Live' : session?.status || 'Idle'}
  color={recording ? 'error' : statusTone(session?.status)} size="small" sx={statusChipSx} />
                </Stack>
                )}
              </div>
              {isCompleted ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ color: 'color-mix(in srgb, var(--color-white) 70%, transparent)' }}>Summary</Typography>
                    <IconButton
                      size="small"
                      aria-label="Show summary fullscreen"
                      onClick={() => setSummaryOpen(true)}
                      title="Open summary fullscreen"
                      sx={{
                        ml: 'auto',
                        color: 'color-mix(in srgb, var(--color-white) 70%, transparent)',
                        '&:hover': { color: 'var(--color-white)', backgroundColor: 'color-mix(in srgb, var(--color-white) 10%, transparent)' },
                      }}
                    >
                      <OpenInFullIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label="Show transcript"
                      onClick={() => setTranscriptOpen(true)}
                      title="Show transcription"
                      sx={{
                        color: 'color-mix(in srgb, var(--color-white) 70%, transparent)',
                        '&:hover': { color: 'var(--color-white)', backgroundColor: 'color-mix(in srgb, var(--color-white) 10%, transparent)' },
                      }}
                    >
                      <DescriptionIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Box
                    className="classroom-markdown"
                    sx={{ mt: 1.5, flex: 1, minHeight: 0, overflowY: 'auto', pr: 1 }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{results?.summary?.content || 'No summary available.'}</ReactMarkdown>
                  </Box>
                </>
              ) : (
                <>
              <div className="classroom-wave" data-active={recording ? 'true' : 'false'}>                                                                     
                {[0, 1, 2, 3, 4, 5].map((bar) => (<span key={bar} style={{ animationDelay: `${bar * 120}ms` }} />))}                                          
              </div>                                                                                                                                          
              {recording && (                                                                                                                                 
                <Box sx={{ mt: 2, mb: 2, p: 2, bgcolor: 'color-mix(in srgb, var(--color-white) 5%, transparent)', borderRadius: 2, border: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)' }}>              
                  <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 50%, transparent)', display: 'block', mb: 1 }}>Live Captions:</Typography>                  
                  <Typography variant="body2" sx={{ color: 'var(--color-white)', fontStyle: 'italic' }}>{liveTranscript || 'Listening...'}</Typography>                     
                </Box>                                                                                                                                         
              )}                                                                                                                                              
              <Stack spacing={1.5} sx={{ mt: 3 }}>                                                                                                            
                <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>                                                                         
                  {recording
                  ? (captureMode === 'mic' ? 'Recording your microphone now. Stop when the speaker finishes.' : 'Capturing the shared tab audio now. Stop when the speaker finishes.')
                  : audioReady
                    ? 'Audio uploaded. Press Process transcription to start STT and content generation.'
                    : (isFirefox
                      ? 'Firefox: press Capture audio, then allow the microphone. Firefox cannot capture the tab/meeting sound directly, so it records your microphone instead.'
                      : 'Press Capture audio and pick the tab, window or screen that is playing the meeting.')}                                          
                </Typography>                                                                                                                                 
                {mediaError && <Typography variant="body2" color="error.main">{mediaError}</Typography>}                                                      
                {session?.status === 'failed' && <Typography variant="body2" color="error.main" sx={{ fontWeight: 'bold' }}>Error: {session.error_message ||  
  'Transcription failed.'}</Typography>}                                                                                                                      
                {error && <Typography variant="body2" color="error.main">{error}</Typography>}                                                                
                <Divider sx={{ borderColor: 'color-mix(in srgb, var(--color-white) 8%, transparent)' }} />                                                                                    
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">                                                                                
                  <Chip label={`Language: ${session?.language || 'es'}`} variant="outlined" sx={{ color: 'var(--color-white)' }} />                                         
                  <Chip label={`Uploaded: ${audioReady ? 'Yes' : 'No'}`} variant="outlined" sx={{ color: 'var(--color-white)' }} />                                         
                  <Chip label={`Status: ${session?.status || 'unknown'}`} variant="outlined" sx={{ color: 'var(--color-white)' }} />                                        
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
            </div>

            <Paper className="classroom-card classroom-card-output" elevation={0}>
              <div className="classroom-card-header">                                                                                                         
                <div>                                                                                                                                         
                  <Typography variant="overline" sx={{ letterSpacing: 3, color: 'color-mix(in srgb, var(--color-white) 55%, transparent)' }}>Generated study space</Typography>                
                  <Typography variant="h5" sx={{ color: 'var(--color-white)', mt: 0.5 }}>Transcript and Learning Materials</Typography>                                     
                </div>                                                                                                                                        
                <Button size="small" variant="outlined" onClick={refreshResults} sx={{ borderRadius: 999 }}><RefreshIcon fontSize="small" /></Button>         
              </div>                                                                                                                                          
                                                                                                                                                              
              <div className="classroom-output-stack">                                                                                                        
                {!isCompleted && <div className="classroom-output-block">                                                                                     
                  <Typography variant="subtitle2" sx={{ color: 'color-mix(in srgb, var(--color-white) 70%, transparent)', mb: 1 }}>Transcript</Typography>                                      
                  <TextField                                                                                                                                  
                    value={manualTranscript}                                                                                                                  
                    onChange={(event) => setManualTranscript(event.target.value)}                                                                             
                    placeholder="Optional manual transcript fallback if the recording is not usable."                                                         
                    minRows={6} multiline fullWidth variant="outlined"                                                                                        
                    sx={{ '& .MuiInputBase-root': { color: 'var(--color-white)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'color-mix(in srgb, var(--color-white) 12%, transparent)' } }}       
                  />                                                                                                                                          
                </div>}                                                                                                                                       
                                                                                                                                                              
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, mt: 2.5, mb: 0.5 }}>
                  {focusMode
                    ? <LockIcon sx={{ fontSize: 15, color: 'var(--color-teal)' }} />
                    : <LockOpenIcon sx={{ fontSize: 15, color: 'color-mix(in srgb, var(--color-white) 55%, transparent)' }} />}
                  <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 70%, transparent)', fontWeight: 600, letterSpacing: 0.3 }}>
                    Focus Mode
                  </Typography>
                  <Switch
                    checked={focusMode}
                    onChange={(e) => setFocusMode(e.target.checked)}
                    size="small"
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: 'var(--color-teal)' },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: 'var(--color-teal)' },
                      '& .MuiSwitch-switchBase.Mui-checked:hover': { backgroundColor: 'color-mix(in srgb, var(--color-teal) 12%, transparent)' },
                    }}
                  />
                </Box>

                <Box sx={{ mt: 1, borderBottom: 1, borderColor: 'color-mix(in srgb, var(--color-white) 10%, transparent)' }}>
                  <Tabs
                    value={activeTab}
                    onChange={(e, newVal) => setActiveTab(newVal)}                                                                                            
                    textColor="var(--color-white)"                                                                                                                          
                    indicatorColor="primary"                                                                                                                  
                    sx={{ '& .MuiTab-root': { color: 'color-mix(in srgb, var(--color-white) 60%, transparent)', fontSize: 14, fontWeight: 500 } }}                                              
                  >                                                                                                                                           
                    {tabs.map((tab, index) => <Tab key={tab} label={tab} sx={{ color: activeTab === index ? 'var(--color-white)' : 'color-mix(in srgb, var(--color-white) 60%, transparent)' }} />)}          
                  </Tabs>                                                                                                                                     
                </Box>                                                                                                                                        
                                                                                                                                                              
                <div className="classroom-tab-content" style={{ mt: 2 }}>                                                                                     
                  {results ? (
                    <>
                      {activeTab === 0 && (
                        <div className="classroom-output-block">
                          <Typography variant="subtitle2" sx={{ color: 'color-mix(in srgb, var(--color-white) 70%, transparent)', mb: 1 }}>MCQs ({results.mcqs?.length || 0})</Typography>
                          <ClassroomQuiz mcqs={results.mcqs} sessionId={sessionId} focus={focusMode} onStart={() => openFocus('mcq')} />
                        </div>
                      )}
                      {activeTab === 1 && (
                        <div className="classroom-output-block">
                          <ClassroomClozePanel clozes={results.clozes} sessionId={sessionId} focus={focusMode} onStart={() => openFocus('cloze')} />
                        </div>
                      )}
                      {activeTab === 2 && (
                        <div className="classroom-output-block">
                          <ClassroomFeynmanPanel sessionId={session.id} prompts={results.feynmans} language={session.language || 'en'} focus={focusMode} onStart={() => openFocus('feynman')} />
                        </div>
                      )}
                    </>                                                                                                                                       
                  ) : (                                                                                                                                       
                    <div className="classroom-empty-state">                                                                                                   
                      <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>                                                                   
                        {session?.status === 'completed' ? 'No materials found.' : 'Once transcription completes, the summary and learning items will appear  here.'}                                                                                                                                                     
                      </Typography>                                                                                                                           
                    </div>                                                                                                                                    
                  )}                                                                                                                                          
                </div>                                                                                                                                        
              </div>                                                                                                                                          
            </Paper>                                                                                                                                          
          </div>

          <Dialog
            open={transcriptOpen}
            onClose={() => setTranscriptOpen(false)}
            fullWidth
            maxWidth="md"
            PaperProps={{
              style: { backgroundColor: '#1A2A3A' },
              sx: {
                borderRadius: '20px',
                boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
                overflow: 'hidden',
              },
            }}
            slotProps={{
              backdrop: { sx: { backgroundColor: 'color-mix(in srgb, var(--color-black) 60%, transparent)' } },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2.25, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <Typography sx={{ color: 'white', fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>
                Transcription
              </Typography>
              <IconButton onClick={() => setTranscriptOpen(false)} size="small" sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <DialogContent sx={{ p: 3, maxHeight: '70vh' }}>
              <Typography variant="body1" sx={{ color: 'var(--color-white)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {storedTranscript || 'No transcript available.'}
              </Typography>
            </DialogContent>
          </Dialog>

          <Dialog
            open={summaryOpen}
            onClose={() => setSummaryOpen(false)}
            fullWidth
            maxWidth="md"
            PaperProps={{
              style: { backgroundColor: '#1A2A3A' },
              sx: {
                borderRadius: '20px',
                boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
                maxHeight: '92vh',
                overflow: 'hidden',
              },
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
                <OpenInFullIcon sx={{ color: 'var(--color-teal)', fontSize: 18 }} />
                <Typography sx={{ color: 'var(--color-white)', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
                  Summary
                </Typography>
              </Stack>
              <IconButton onClick={() => setSummaryOpen(false)} size="small" sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <DialogContent sx={{ p: { xs: 2, sm: 3 }, overflowY: 'auto' }}>
              <Box className="classroom-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{results?.summary?.content || 'No summary available.'}</ReactMarkdown>
              </Box>
            </DialogContent>
          </Dialog>

          <Dialog
            open={Boolean(focusSession)}
            onClose={() => setFocusSession(null)}
            fullWidth
            maxWidth="md"
            PaperProps={{
              style: { backgroundColor: '#1A2A3A' },
              sx: {
                borderRadius: '20px',
                boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
                maxHeight: '92vh',
                overflow: 'hidden',
              },
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
                  Focus Mode · {focusSession === 'mcq' ? 'MCQs' : focusSession === 'cloze' ? 'Clozes' : 'Feynman'}
                </Typography>
              </Stack>
              <IconButton onClick={() => setFocusSession(null)} size="small" sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <DialogContent sx={{ p: { xs: 1.5, sm: 3 }, overflowY: 'auto' }}>
              {focusSession === 'mcq' && <ClassroomQuiz key={focusKey} mcqs={results?.mcqs} sessionId={sessionId} autoStart onExit={() => setFocusSession(null)} />}
              {focusSession === 'cloze' && <ClassroomClozePanel key={focusKey} clozes={results?.clozes} sessionId={sessionId} autoStart />}
              {focusSession === 'feynman' && (
                <ClassroomFeynmanPanel key={focusKey} sessionId={session.id} prompts={results?.feynmans} language={session.language || 'en'} autoStart />
              )}
            </DialogContent>
          </Dialog>

          <CaptureAudioModal
            open={captureInfoOpen}
            onClose={() => setCaptureInfoOpen(false)}
          />

          <Dialog
            open={silenceDialogOpen}
            onClose={() => setSilenceDialogOpen(false)}
            fullWidth
            maxWidth="sm"
            aria-labelledby="silence-session-title"
            PaperProps={{
              style: {
                background: 'linear-gradient(135deg, var(--color-navy-050) 0%, var(--color-navy-200) 48%, var(--color-navy) 100%)',
              },
              sx: {
                width: { xs: '92vw', sm: 560 },
                maxWidth: '92vw',
                borderRadius: '20px',
                boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
                overflow: 'hidden',
                position: 'relative',
              },
            }}
            slotProps={{
              backdrop: { sx: { backgroundColor: 'color-mix(in srgb, var(--color-black) 60%, transparent)' } },
            }}
          >
            {/* Teal / blue glow accents over the navy gradient (matches CaptureAudioModal) */}
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background:
                  'radial-gradient(circle at top left, color-mix(in srgb, var(--color-teal) 20%, transparent), transparent 45%), ' +
                  'radial-gradient(circle at bottom right, color-mix(in srgb, var(--color-blue) 22%, transparent), transparent 48%)',
              }}
            />

            <Box sx={{ position: 'relative', p: 3 }}>
              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography id="silence-session-title" variant="h6" sx={{ color: 'var(--color-white)', fontWeight: 700, letterSpacing: '-0.01em' }}>
                  Recording stopped (silence)
                </Typography>
                <IconButton onClick={() => setSilenceDialogOpen(false)} size="small" sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>

              <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 78%, transparent)', mb: 2 }}>
                No audio was detected for 1 minute, so the capture stopped automatically. Choose what to do with the recording.
              </Typography>

              {!audioReady && (
                <Box sx={{ p: 2, borderRadius: 3, background: 'color-mix(in srgb, var(--color-white) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)', mb: 2 }}>
                  <Typography variant="body2" sx={{ color: 'var(--color-amber)' }}>
                    No usable audio was captured — you may want to recapture.
                  </Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1.5 }}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={() => { setSilenceDialogOpen(false); startListening(); }}
                  sx={{
                    px: 3,
                    py: 1.15,
                    borderRadius: '999px',
                    fontWeight: 700,
                    fontSize: 14,
                    textTransform: 'none',
                    color: 'var(--color-white)',
                    borderColor: 'color-mix(in srgb, var(--color-white) 22%, transparent)',
                    '&:hover': { borderColor: 'var(--color-teal)', backgroundColor: 'color-mix(in srgb, var(--color-teal) 10%, transparent)' },
                  }}
                >
                  Recapture
                </Button>
                <Button
                  variant="contained"
                  disabled={!audioReady || processing}
                  onClick={async () => { setSilenceDialogOpen(false); await processTranscript(); }}
                  sx={{
                    px: 4,
                    py: 1.15,
                    borderRadius: '999px',
                    fontWeight: 700,
                    fontSize: 14,
                    textTransform: 'none',
                    backgroundColor: 'var(--color-success)',
                    color: 'var(--color-navy-deep)',
                    '&:hover': { backgroundColor: 'var(--color-teal-pale)' },
                    '&.Mui-disabled': { color: 'color-mix(in srgb, var(--color-navy-deep) 45%, transparent)' },
                  }}
                >
                  {processing ? 'Processing…' : 'Process audio'}
                </Button>
              </Box>
            </Box>
          </Dialog>
        </div>
      </div>
    );
  };

export default Classroom;      