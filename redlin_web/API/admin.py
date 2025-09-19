from django.contrib import admin

# Register your models here.
from .models import Document, Summary, Flashcard, MCQ, User, Cloze, Feynman, FeynmanAttempt

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


@admin.register(Feynman)
class FeynmanAdmin(admin.ModelAdmin):
    list_display = ("id", "document", "short_prompt", "created_at", "attempts_count")
    search_fields = ("prompt", "document__title", "document__user__username")
    list_filter = ("document",)
    readonly_fields = ("created_at",)

    def short_prompt(self, obj):  # pragma: no cover
        p = obj.prompt or ""
        return (p[:70] + "...") if len(p) > 70 else p
    short_prompt.short_description = "Prompt"

    def attempts_count(self, obj):  # pragma: no cover
        return obj.attempts.count()
    attempts_count.short_description = "Intentos"


@admin.register(FeynmanAttempt)
class FeynmanAttemptAdmin(admin.ModelAdmin):
    list_display = ("id", "feynman", "user", "score", "tier", "key_points_coverage", "created_at")
    search_fields = ("feynman__prompt", "user__username", "answer_text")
    list_filter = ("tier", "score", "user")
    readonly_fields = ("created_at", "updated_at", "score", "tier", "breakdown", "key_points_coverage")