from API.services.processing_common import generate_with_retry                
from CLASSROOM.models import ClassSession, ClassSessionSummary
                                                                              
def generate_session_summary(class_session: ClassSession, text: str, lang_label: str, output_lang_instruction: str) -> str:                        
    doc_title = (class_session.title or "Class Session").strip()
    summary_prompt = f"""                                                     
    You are an expert academic summarizer. {output_lang_instruction}              
                                                                                
    GOAL                                                                          
    Produce a high-signal, chapter/section-structured summary that captures the   
    core intellectual substance of the source.                                    
                                                                                
    OUTPUT FORMAT (Pure Markdown only)                                            
    - First line MUST be exactly an H1 with the document title:                   
    # {doc_title}                                                               
    - After the title, output the structured summary only. No preamble, no meta   
    text, no "analysis".                                                          
    - Use section headings as H2 ("##"), each starting with ONE emoji + space +   
    concise heading (no trailing punctuation).                                    
    - Under each heading, use dense bullets ("- ") OR tight mini paragraphs.      
    - Final section must be:                                                      
    ## ⭐ Key Takeaways                                                         
    - 5-12 distilled bullets (no redundancy). 
    CONTENT RULES (Absolute)                                                      
    - Omit front matter: copyright notices, ISBN, disclaimers, dedications, 
    acknowledgments.                                                              
    - Preserve the source's logic and argument flow; merge or skip low-value      
    sections.                                                                     
    - No hallucinations. Only include concepts supported by the source.           
    - Remove repetition and ornamental filler; keep mechanisms, definitions,      
    claims, evidence, results, implications, limitations.                         
    - Include concrete numbers, definitions, and conditions when present.         
    - Use brief emphasis for pivotal terms (bold) sparingly.                      
    - Tables are allowed if they clarify comparisons or taxonomies.               
    - Forbidden phrases anywhere: "Here is", "This book", "The document", "This 
    section".                                                                     
    - Output language: {lang_label}                                               
                                                                                
    SOURCE TEXT (for analysis; paraphrase in output)                              
    {text}                                                                        
    """                                                                           
    try:                                                                      
        response = generate_with_retry(summary_prompt, max_attempts=3)        
        content = response.text                                               
    except Exception as exc:                 
        content = f"Title: {doc_title}\n\n(Error during generation: {exc})"   
                                                                              
    ClassSessionSummary.objects.update_or_create(                             
        class_session=class_session,                                          
        defaults={"content": content},                                        
    )                                                                         
    return content