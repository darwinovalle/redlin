from django.urls import include, path                                                                                                                       
from rest_framework.routers import DefaultRouter                                                                                                            
                                                                                                                                                            
from .views import (                                                                                                                                        
    ClassSessionViewSet,                     
    ClassSessionSummaryViewSet,                                                                                                                             
    ClassSessionMCQViewSet,                                                                                                                                 
    ClassSessionClozeViewSet,                                                                                                                               
    ClassSessionFeynmanViewSet                                                                                                                              
)                                                                                                                                                           
                                                                                                                                                            
router = DefaultRouter()                                                                                                                                    
router.register(r"sessions", ClassSessionViewSet, basename="classroom-session")                                                                             
router.register(r"summaries", ClassSessionSummaryViewSet, basename="classroom-summary")                                                                     
router.register(r"mcqs", ClassSessionMCQViewSet, basename="classroom-mcq")                                                                                  
router.register(r"clozes", ClassSessionClozeViewSet, basename="classroom-cloze")                                                                            
router.register(r"feynman", ClassSessionFeynmanViewSet, basename="classroom-feynman")                                                                       
                                                                                                                                                            
urlpatterns = [                              
    path("", include(router.urls)),                                                                                                                         
]
