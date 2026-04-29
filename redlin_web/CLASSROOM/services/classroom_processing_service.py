from API.services.processing_common import detect_language                                                                                                  
from .summary_service import generate_session_summary                                                                                                       
from .mcq_service import generate_session_mcqs                                                                                                              
from .cloze_service import generate_session_clozes                                                                                                          
from .feynman_generation_service import generate_session_feynman                                                                                           
                                                                                                                                                            
def process_classroom_session_text(class_session, text: str) -> None:
    """                                                                                                                                                     
    Mirroring the behavior of API/services/document_processing_service.py                                                                                   
    """                                                                                                                                                     
    try:                                                                                                                                                    
        cleaned_text = (text or "").strip()                                                                                                                 
        if not cleaned_text:                                                                                                                                
            raise ValueError("Could not extract text from source")                                                                                          
                                                                                                                                                            
        dominant = detect_language(cleaned_text)                                                                                                            
        target_lang = dominant if dominant in {"en", "es"} else "en"                                                                                        
        lang_label = "English" if target_lang == "en" else "Spanish"                                                                                        
        output_lang_instruction = (                                                                                                                         
            "Produce la salida en Espanol." if target_lang == "es" else "Produce the output in English."                                                    
        )                                                                                                                                                   
                                          
        # 1. Generate Summary             
        summary_content = generate_session_summary(
            class_session, cleaned_text, lang_label, output_lang_instruction
        )                                                                                                                                                   
                                                                                                                                                            
        # 2. Generate MCQs                                                                                                                                  
        generate_session_mcqs(class_session, cleaned_text, lang_label)                                                                                      
                                                                                                                                                            
        # 3. Generate Clozes                                                                                                                                
        generate_session_clozes(class_session, cleaned_text, lang_label, summary_content)                                                                   

        # 4. Generate Feynman prompts                                                                                                                        
        generate_session_feynman(class_session, cleaned_text, summary_content, lang_label)                                                                  
                                                                                                                                                            
        print(f"Successfully processed ClassSession {class_session.id}.")                                                                                   
    except Exception as exc:                                                                                                                                
        print(f"[Fatal Error] Processing failed for ClassSession {class_session.id}: {exc}")
        raise exc