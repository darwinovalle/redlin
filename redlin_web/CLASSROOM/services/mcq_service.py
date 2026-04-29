from django.db import transaction                                             
from API.services.processing_common import generate_with_retry                
from CLASSROOM.models import ClassSession, ClassSessionMCQ                    
                                                                              
def generate_session_mcqs(class_session: ClassSession, text: str, lang_label: str) -> int:                                                                  
    mcq_prompt = f"""                                                         
    You are an expert assessment designer specializing in educational content     
    analysis.                                                                     
    TASK: Extract and convert ALL testable knowledge from the provided text into  
    multiple-choice questions.                                                    
    Language: {lang_label}                                                        
                                                                                
    CRITICAL REQUIREMENTS:                                                        
    1. EXHAUSTIVE COVERAGE: Create questions for EVERY significant concept, fact, 
    or principle.                                                                 
    2. ACCURACY GUARANTEE: Correct answer must be 100% verifiable from the text.  
    3. DISTRACTOR RULES: Each incorrect option must be plausible but definitively 
    wrong.                                                                        
    4. FORBIDDEN CONTENT: No "All/None of the above", no negatively-phrased 
    questions.                                                                    
    5. EXACT FORMAT:                                                              
    Q: <Question text>                                                         
    A: <Correct Answer>                                                        
    B: <Incorrect Option 1>                                                    
    C: <Incorrect Option 2>                                                    
    D: <Incorrect Option 3>                                                    
                                                
    SOURCE TEXT:                                                                  
    {text}                                                                        
    """                                                                           
    try:                                                                      
        response = generate_with_retry(mcq_prompt, max_attempts=3)            
        mcq_blocks = response.text.strip().split("\n\n")                      
        new_mcqs = []                                                         
        for block in mcq_blocks:                                              
            lines = block.strip().split("\n")                                 
            if len(lines) == 5:                                               
                q_line, a_line, b_line, c_line, d_line = lines                
                if (q_line.startswith("Q:") and a_line.startswith("A:") and b_line.startswith("B:") and c_line.startswith("C:") and d_line.startswith("D:")):                                                     
                                                                              
                    new_mcqs.append(ClassSessionMCQ(                          
                        class_session=class_session,                          
                        question=q_line.replace("Q:", "").strip(),            
                        correct_answer=a_line.replace("A:", "").strip(),      
                        option_1=b_line.replace("B:", "").strip(),            
                        option_2=c_line.replace("C:", "").strip(),            
                        option_3=d_line.replace("D:", "").strip(),            
                    ))                       
                                                                              
        if new_mcqs:                                                          
            with transaction.atomic():
                ClassSessionMCQ.objects.filter(class_session=class_session).delete()
                ClassSessionMCQ.objects.bulk_create(new_mcqs)                 
            return len(new_mcqs)
    except Exception as exc:
        print(f"[Error] ClassSession MCQ generation failed: {exc}")           
    return 0 