from django.contrib import admin
from .models import CSVImport, CSVFlashcard


@admin.register(CSVImport)
class CSVImportAdmin(admin.ModelAdmin):
	list_display = ("id", "user", "filename", "row_count", "created_at")
	list_filter = ("created_at",)
	search_fields = ("filename", "user__username")


@admin.register(CSVFlashcard)
class CSVFlashcardAdmin(admin.ModelAdmin):
	list_display = (
		"id", "user", "key_term", "status", "times_shown", "repetitions", "easiness", "interval"
	)
	list_filter = ("status",)
	search_fields = ("key_term", "definition", "user__username")

