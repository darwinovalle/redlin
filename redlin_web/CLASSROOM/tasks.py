from celery import shared_task                                                                                                                              
import logging                                                                                                                                              
                                                                                                                                                            
from .models import ClassSession                                                                                                                            
from .services.session_processing_service import process_class_session, transcribe_class_session                                                            
                                                                                                                                                            
logger = logging.getLogger(__name__)                                                                                                                        
                                                                                                                                                            
@shared_task(                                                                                                                                               
    bind=True,  
    name="CLASSROOM.tasks.transcribe_class_session",                                                                                                        
    time_limit=1800,         # Hard limit: 30 minutes                                                                                                       
    soft_time_limit=1500      # Soft limit: 25 minutes                                                                                                      
)                                                                                                                                                           
def transcribe_class_session_task(self, session_id: int):                                                                                                   
    # DEBUG: This must appear in redlin-worker logs immediately                                                                                             
    print(f"!!! [CELERY] Received transcription task for session {session_id} !!!")                                                                         
    logger.info(f"Starting transcription process for session {session_id}")                                                                                 
                                                                                                                                                            
    try:                                                                                                                                                    
        transcribe_class_session(session_id)                                                                                                                
                                                                                                                                                            
        # Check if the transcription succeeded and marked the session as READY                                                                              
        session_status = ClassSession.objects.filter(id=session_id).values_list("status", flat=True).first()                                                
                                                                                                                                                            
        if session_status == ClassSession.STATUS_READY:                                                                                                     
            print(f"!!! [CELERY] Transcription successful for session {session_id}. Queueing processing...")                                                
            process_class_session(session_id)                                                                                                               
        else:                                                                                                                                               
            print(f"!!! [CELERY] Transcription did not result in READY status for session {session_id}. Status is: {session_status}")                       
                                                                                                                                                            
        return {"status": "ok", "session_id": session_id}                                                                                                   
    except Exception as e:                                                                                                                                  
        print(f"!!! [CELERY] CRITICAL ERROR during transcription for session {session_id}: {str(e)}")                                                       
        logger.exception(f"Transcription task failed for session {session_id}")                                                                             
        return {"status": "error", "session_id": session_id, "error": str(e)}                                                                               
                                                                                                                                                            
                                                                                                                                                            
@shared_task(                                                                                                                                               
    bind=True,                                                                                                                                              
    name="CLASSROOM.tasks.process_class_session",                                                                                                           
    time_limit=1200,         # Hard limit: 20 minutes                                                                                                       
    soft_time_limit=900       # Soft limit: 15 minutes                                                                                                      
)                                                                                                                                                           
def process_class_session_task(self, session_id: int):                                                                                                      
    print(f"!!! [CELERY] Starting content processing for session {session_id} !!!")                                                                         
    try:                                                                                                                                                    
        process_class_session(session_id)                                                                                                                   
        return {"status": "ok", "session_id": session_id}                                                                                                   
    except Exception as e:                                                                                                                                  
        print(f"!!! [CELERY] CRITICAL ERROR during processing for session {session_id}: {str(e)}")                                                          
        logger.exception(f"Processing task failed for session {session_id}")                                                                                
        return {"status": "error", "session_id": session_id, "error": str(e)}
