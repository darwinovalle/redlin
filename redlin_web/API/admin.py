from django.contrib import admin

# Register your models here.
from .models import Document, Summary, Flashcard, MCQ, User

admin.site.register(Document)
admin.site.register(Summary)
admin.site.register(MCQ)
admin.site.register(User)

@admin.register(Flashcard)
class FlashcardAdmin(admin.ModelAdmin):
    list_display = (
        "id", "document", "key_term", "status",
        "score", "times_shown", "repetitions", "easiness", "interval", "next_review_at"
    )
    list_filter = ("status", "document")
    search_fields = ("key_term", "definition", "document__title")