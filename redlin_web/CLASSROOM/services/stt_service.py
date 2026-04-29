import os
from dataclasses import dataclass                                             
from typing import Any                                                        
import logging                                                                
from faster_whisper import WhisperModel                           
                                                                              
logger = logging.getLogger(__name__)                                          
                                                                              
class STTServiceError(Exception):                                             
    """Raised when local STT processing fails."""
                                                                              
@dataclass                                                                    
class STTSegment:                                                             
    sequence: int                                                             
    text: str                                                                 
    start_sec: float | None = None                                            
    end_sec: float | None = None                                              
    confidence: float | None = None                                           
                                                                              
@dataclass                                                                    
class STTResult:                                                              
    text: str                                                                 
    segments: list[STTSegment]                                                
                                                                              
def _normalize_text(text: str) -> str:                                        
    return " ".join((text or "").split()).strip()                             
                                                                              
# --- SINGLETON MODEL INITIALIZATION ---                                      
# We load the model here, at the module level, so it happens ONCE when the server starts.                                                                
# This prevents the "stuck in transcribing" issue caused by reloading the model every request.
_MODEL_INSTANCE = None

def get_whisper_model():                                                                                                                                    
    global _MODEL_INSTANCE                                                                                                                                  
    if _MODEL_INSTANCE is None:                                                                                                                             
        try:                                                                                                                                                
            model_size = os.getenv("STT_MODEL_SIZE", "tiny")                                                                                                
            device = os.getenv("STT_DEVICE", "cpu")                                                                                                         
            # CHANGE: Using float32 instead of int8 for maximum compatibility                                                                               
            compute_type = "float32"                                                                                                                        
                                                                                                                                                            
            print(f"!!! [STT] Attempting to instantiate WhisperModel now... !!!")                                                                           
            # This is the exact line where the process is disappearing                                                                                      
            _MODEL_INSTANCE = WhisperModel(model_size, device=device, compute_type=compute_type)                                                            
            print(f"!!! [STT] WhisperModel successfully instantiated! !!!")                                                                                 
                                                                                                                                                            
        except Exception as exc:                                                                                                                            
            print(f"!!! [STT] CRITICAL ERROR during WhisperModel creation: {exc} !!!")                                                                      
            logger.error(f"Failed to initialize Whisper Model: {exc}")                                                                                      
            raise STTServiceError(f"Model initialization failed: {exc}")                                                                                    
                                                                                                                                                            
    return _MODEL_INSTANCE                                                   
                                                                              
def transcribe_audio_file(audio_path: str, language_hint: str | None = None) -> STTResult:                                                                  
    """Transcribe an audio file using the singleton faster-whisper model."""                                                                                
    try:                                                                                                                                                    
        print(f"!!! [STT] Starting transcription for file: {audio_path} !!!")                                                                               
        model = get_whisper_model()                                                                                                                         
                                                                                                                                                            
        enable_vad = os.getenv("STT_ENABLE_VAD", "true").lower() in {"1", "true", "yes", "on"}                                                              
                                                                                                                                                            
        print(f"!!! [STT] Calling model.transcribe now... (this is where it usually hangs) !!!")                                                            
        segments_iter, _info = model.transcribe(
            audio_path,                                                                                                                                     
            language=language_hint or os.getenv("STT_LANGUAGE") or None,                                                                                    
            vad_filter=enable_vad,                                                                                                                          
        )                                                                                                                                                   
        print(f"!!! [STT] model.transcribe returned. Now iterating segments... !!!")                                                                        
                                                                                                                                                            
        collected: list[STTSegment] = []                                                                                                                    
        full_text_parts: list[str] = []                                                                                                                     
                                                                                                                                                            
        for idx, seg in enumerate(segments_iter, start=1):                                                                                                  
            print(f"!!! [STT] Processed segment {idx} !!!") # Log every single segment                                                                      
            text = _normalize_text(getattr(seg, "text", ""))                                                                                                
            if not text:                                                                                                                                    
                continue                                                                                                                                    
                                                                                                                                                            
            start_sec = float(seg.start) if getattr(seg, "start", None) is not None else None                                                               
            end_sec = float(seg.end) if getattr(seg, "end", None) is not None else None                                                                     
                                                                                                                                                            
            collected.append(                                                                                                                               
                STTSegment(                                                                                                                                 
                    sequence=idx,                                                                                                                           
                    text=text,                                                                                                                              
                    start_sec=start_sec,                                                                                                                    
                    end_sec=end_sec,                                                                                                                        
                    confidence=None,                                                                                                                        
                )                                                                                                                                           
            )                                                                                                                                               
            full_text_parts.append(text)                                                                                                                    
                                                                                                                                                            
        full_text = _normalize_text(" ".join(full_text_parts))                                                                                              
        print(f"!!! [STT] Transcription COMPLETE. Total segments: {len(collected)} !!!")                                                                    
        return STTResult(text=full_text, segments=collected)                                                                                                
                                                                                                                                                            
    except Exception as exc:                                                                                                                                
        logger.exception("Transcription error occurred")                                                                                                    
        print(f"!!! [STT] EXCEPTION caught: {str(exc)}")                                                                                                    
        raise STTServiceError(f"Local transcription failed: {exc}") from exc
