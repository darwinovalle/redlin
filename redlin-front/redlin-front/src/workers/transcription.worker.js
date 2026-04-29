  // Use the official ESM build from the CDN                                    
  import { pipeline, env } from                                                 
  'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1';                   
                                                                                
  // IMPORTANT: This is the fix for CORB/CORS and model loading issues          
  env.allowRemoteModels = true;
  env.allowLocalModels = false;                                                 
                                                                                
  let transcriber = null;                                                       
                                                                                
  self.onmessage = async (event) => {                                           
    const { type, audio, language } = event.data;
                                                                                
    if (type === 'init') {                                                      
      try {                                                                     
        // Using whisper-tiny to avoid system crashes (RAM issues)              
        transcriber = await pipeline('automatic-speech-recognition',            
  'Xenova/whisper-tiny', {                                                      
          device: 'wasm',                                                       
        });                                                                     
        self.postMessage({ type: 'ready' });                                    
      } catch (err) {                                                           
        self.postMessage({ type: 'error', message: `Model load failed:          
  ${err.message}` });                                                           
      }                                                                         
      return;                                                                   
    }                                                                           
                                                                                
    if (type === 'transcribe') {                                                
      if (!transcriber) {                                                       
        self.postMessage({ type: 'error', message: 'Model not initialized' });  
        return;                                                                 
      }                                                                         
                                                                                
      try {                                                                     
        const result = await transcriber(audio, {                               
          language: language,                                                   
          task: 'transcribe',                                                   
          chunk_length_s: 30,                                                   
          stride_length_s: 5                                                    
        });                                                                     
        self.postMessage({ type: 'result', text: result.text });                
      } catch (err) {                                                           
        self.postMessage({ type: 'error', message: `Transcription failed:       
  ${err.message}` });                                                           
      }                                                                         
    }                                                                           
  };     