from django.contrib import admin

# Register your models here.
from .models import Document, Summary, Flashcard, MCQ, User

admin.site.register(Document)
admin.site.register(Summary)
admin.site.register(Flashcard)
admin.site.register(MCQ)
admin.site.register(User)