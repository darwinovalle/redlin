from django.contrib import admin
from .models import Video, VideoSummary, VideoMCQ


class VideoSummaryInline(admin.StackedInline):
    model = VideoSummary
    can_delete = False
    extra = 0


class VideoMCQInline(admin.TabularInline):
    model = VideoMCQ
    extra = 0
    fields = ("question", "correct_answer", "option_1", "option_2", "option_3")
    show_change_link = True


@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "video_id",
        "url",
        "processing_status",
        "snippet_count",
        "created_at",
    )
    list_filter = ("processing_status", "created_at")
    search_fields = ("video_id", "url", "user__username")
    readonly_fields = ("created_at", "snippet_count", "video_id", "transcript_text")
    inlines = [VideoSummaryInline, VideoMCQInline]


@admin.register(VideoSummary)
class VideoSummaryAdmin(admin.ModelAdmin):
    list_display = ("id", "video", "short_content")
    search_fields = ("video__video_id", "content")

    def short_content(self, obj):
        return (obj.content[:80] + "...") if len(obj.content) > 80 else obj.content
    short_content.short_description = "Contenido"


@admin.register(VideoMCQ)
class VideoMCQAdmin(admin.ModelAdmin):
    list_display = ("id", "video", "short_question", "correct_answer")
    search_fields = ("question", "correct_answer", "video__video_id")
    list_filter = ("video__processing_status",)

    def short_question(self, obj):
        return (obj.question[:70] + "...") if len(obj.question) > 70 else obj.question
    short_question.short_description = "Pregunta"
