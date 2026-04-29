from django.contrib import admin                                                                                                                            
from .models import (                                                                                                                                       
    ClassSession,                         
    TranscriptSegment,                                                                                                                                      
    ClassSessionSummary,                     
    ClassSessionMCQ,                                                                                                                                        
    ClassSessionCloze,                                                                                                                                      
    ClassSessionFeynman,                                                                                                                                    
    ClassSessionFeynmanAttempt                                                                                                                              
)                                                                                                                                                           
                                                                                                                                                            
@admin.register(ClassSession)                                                                                                                               
class ClassSessionAdmin(admin.ModelAdmin):                                                                                                                  
    list_display = ("id", "title", "user", "status", "language", "created_at")                                                                              
    search_fields = ("title", "user__username", "user__email")                                                                                              
    list_filter = ("status", "language", "created_at")                                                                                                      
                                                                                                                                                            
                                                                                                                                                            
@admin.register(TranscriptSegment)                                                                                                                          
class TranscriptSegmentAdmin(admin.ModelAdmin):                                                                                                             
    list_display = ("id", "class_session", "sequence", "start_sec", "end_sec")                                                                              
    search_fields = ("class_session__title", "text")                                                                                                        
    list_filter = ("created_at",)                                                                                                                           
                                                                                                                                                            
                                                                                                                                                            
@admin.register(ClassSessionSummary)                                                                                                                        
class ClassSessionSummaryAdmin(admin.ModelAdmin):                                                                                                           
    list_display = ("id", "class_session", "content_snippet")                                                                                               
    search_fields = ("class_session__title", "content")                                                                                                     
                                                                                                                                                            
    def content_snippet(self, obj):                                                                                                                         
        return (obj.content[:70] + "...") if len(obj.content) > 70 else obj.content                                                                         
    content_snippet.short_description = "Contenido"                                                                                                         
                                                                                                                                                            
                                                                                                                                                            
@admin.register(ClassSessionMCQ)                                                                                                                            
class ClassSessionMCQAdmin(admin.ModelAdmin):                                                                                                               
    list_display = ("id", "class_session", "question_snippet", "correct_answer")                                                                            
    search_fields = ("question", "class_session__title")                                                                                                    
                                                                                                                                                            
    def question_snippet(self, obj):                                                                                                                        
        return (obj.question[:70] + "...") if len(obj.question) > 70 else obj.question                                                                      
    question_snippet.short_description = "Pregunta"                                                                                                         
                                                                                                                                                            
                                                                                                                                                            
@admin.register(ClassSessionCloze)                                                                                                                          
class ClassSessionClozeAdmin(admin.ModelAdmin):                                                                                                             
    list_display = ("id", "class_session", "short_blank", "answer", "difficulty", "created_at")                                                             
    list_filter = ("difficulty", "class_session")                                                                                                           
    search_fields = ("text_with_blank", "answer", "class_session__title")                                                                                   
    readonly_fields = ("created_at",)                                                                                                                       
                                                                                                                                                            
    def short_blank(self, obj):                                                                                                                             
        txt = obj.text_with_blank or ""                                                                                                                     
        return (txt[:70] + "...") if len(txt) > 70 else txt                                                                                                 
    short_blank.short_description = "Texto"                                                                                                                 
                                                                                                                                                            
                                                                                                                                                            
@admin.register(ClassSessionFeynman)                                                                                                                        
class ClassSessionFeynmanAdmin(admin.ModelAdmin):                                                                                                           
    list_display = ("id", "class_session", "short_prompt", "created_at", "attempts_count")                                                                  
    search_fields = ("prompt", "class_session__title")                                                                                                      
    list_filter = ("class_session",)                                                                                                                        
    readonly_fields = ("created_at",)                                                                                                                       
                                                                                                                                                            
    def short_prompt(self, obj):                                                                                                                            
        p = obj.prompt or ""                                                                                                                                
        return (p[:70] + "...") if len(p) > 70 else p                                                                                                       
    short_prompt.short_description = "Prompt"                                                                                                               
                                                                                                                                                            
    def attempts_count(self, obj):                                                                                                                          
        return obj.attempts.count()                                                                                                                         
    attempts_count.short_description = "Intentos"                                                                                                           
                                                                                                                                                            
                                                                                                                                                            
@admin.register(ClassSessionFeynmanAttempt)                                                                                                                 
class ClassSessionFeynmanAttemptAdmin(admin.ModelAdmin):                                                                                                    
    list_display = ("id", "feynman", "user", "score", "tier", "key_points_coverage", "created_at")                                                          
    search_fields = ("feynman__prompt", "user__username", "answer_text")                                                                                    
    list_filter = ("tier", "score", "user")                                                                                                                 
    readonly_fields = ("created_at", "updated_at", "score", "tier", "breakdown", "key_points_coverage")
