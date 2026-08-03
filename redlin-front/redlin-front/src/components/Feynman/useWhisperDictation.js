import { useCallback, useEffect, useRef, useState } from 'react';
import TranscriptionWorker from '../../workers/transcription.worker.js?worker';

const VOICED_RMS = 0.01; // below this the input counts as silence
const SILENCE_MS = 2000; // auto-stop after ~2s with no speech
const POLL_MS = 300; // silence check cadence

// Whisper expects 16 kHz mono; the mic may run at the device's native rate.
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

// Firefox fallback dictation engine. Records the mic, auto-stops on silence,
// then transcribes the whole utterance in one shot with whisper-base. Web
// Speech (Chrome/Safari/Edge) stays the fast path — this is only used when
// SpeechRecognition is unavailable.
const useWhisperDictation = ({ language = 'en', onTranscript, onError }) => {
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [micError, setMicError] = useState('');

  const workerRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const lastVoicedRef = useRef(Date.now());
  const stoppedRef = useRef(false);

  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const cleanupStream = useCallback(() => {
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => { try { track.stop(); } catch {} });
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
  }, []);

  const ensureWorker = useCallback(async () => {
    if (workerRef.current) return workerRef.current;
    const worker = new TranscriptionWorker();
    workerRef.current = worker;
    await new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        if (e.data.type === 'ready') resolve(worker);
        else if (e.data.type === 'error') reject(new Error(e.data.message));
      };
      worker.onerror = () => reject(new Error('Whisper worker failed to load'));
      worker.postMessage({ type: 'init', language, model: 'Xenova/whisper-base' });
    });
    return worker;
  }, [language]);

  const transcribe = useCallback(async (samples) => {
    const worker = await ensureWorker();
    const text = await new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        if (e.data.type === 'result') resolve(e.data.text);
        else if (e.data.type === 'error') reject(new Error(e.data.message));
      };
      worker.onerror = () => reject(new Error('Transcription failed'));
      worker.postMessage({ type: 'transcribe', audio: samples, language });
    });
    return text;
  }, [ensureWorker, language]);

  const decodeTo16k = useCallback(async (blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new Ctx();
    audioCtxRef.current = audioCtx;
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    const samples = decoded.getChannelData(0);
    return resampleAudio(samples, decoded.sampleRate, 16000);
  }, []);

  const finishRecording = useCallback(async () => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    cleanupStream();
    setListening(false);

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    chunksRef.current = [];
    if (!blob.size) {
      setMicError('No audio detected — try again.');
      return;
    }

    setProcessing(true);
    try {
      const samples = await decodeTo16k(blob);
      const text = await transcribe(samples);
      const clean = text.trim();
      if (clean) onTranscriptRef.current?.(clean);
    } catch (err) {
      setMicError(`Dictation failed: ${err.message}`);
      onErrorRef.current?.(err.message);
    } finally {
      setProcessing(false);
    }
  }, [cleanupStream, decodeTo16k, transcribe]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      finishRecording();
    }
  }, [finishRecording]);

  const start = useCallback(async () => {
    setMicError('');
    if (listening) return;
    stoppedRef.current = false;
    lastVoicedRef.current = Date.now();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const Ctx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new Ctx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = finishRecording;
      recorderRef.current = recorder;
      recorder.start();

      // Auto-stop when the user falls silent.
      const data = new Float32Array(analyser.fftSize);
      silenceTimerRef.current = window.setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);
        if (rms >= VOICED_RMS) {
          lastVoicedRef.current = Date.now();
        } else if (Date.now() - lastVoicedRef.current >= SILENCE_MS) {
          stop();
        }
      }, POLL_MS);

      setListening(true);
    } catch (err) {
      cleanupStream();
      setMicError(
        err?.name === 'NotAllowedError'
          ? 'Microphone access was denied.'
          : `Could not start microphone: ${err.message}`
      );
    }
  }, [listening, cleanupStream, stop]);

  // Teardown on unmount.
  useEffect(() => () => {
    cleanupStream();
    if (workerRef.current) {
      try { workerRef.current.terminate(); } catch {}
      workerRef.current = null;
    }
  }, [cleanupStream]);

  return { listening, processing, micError, start, stop };
};

export default useWhisperDictation;
