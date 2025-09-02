from django.contrib import admin

# Register your models here.
from .models import Document, Summary, Flashcard, MCQ, User, Cloze

admin.site.register(Document)
admin.site.register(Summary)
admin.site.register(MCQ)
admin.site.register(User)


@admin.register(Cloze)
class ClozeAdmin(admin.ModelAdmin):
    list_display = ("id", "document", "short_blank", "answer", "difficulty", "created_at")
    list_filter = ("difficulty", "document",)
    search_fields = ("text_with_blank", "answer", "document__title", "document__user__username")
    readonly_fields = ("created_at",)

    def short_blank(self, obj):  # pragma: no cover - admin display helper
        txt = obj.text_with_blank or ""
        return (txt[:70] + "...") if len(txt) > 70 else txt
    short_blank.short_description = "Texto"

@admin.register(Flashcard)
class FlashcardAdmin(admin.ModelAdmin):
    list_display = (
        "id", "document", "key_term", "status",
        "score", "times_shown", "repetitions", "easiness", "interval", "next_review_at"
    )
    list_filter = ("status", "document")
    search_fields = ("key_term", "definition", "document__title")