from rest_framework import serializers
from .models import CSVImport, CSVFlashcard


class CSVImportSerializer(serializers.ModelSerializer):
    class Meta:
        model = CSVImport
        fields = [
            'id', 'user', 'filename', 'row_count', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'row_count', 'created_at']


class CSVUploadSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, file):
        name = file.name.lower()
        if not name.endswith('.csv'):
            raise serializers.ValidationError('Only .csv files are accepted')
        # Cap size to ~5MB to prevent abuse (adjust as needed)
        if hasattr(file, 'size') and file.size and file.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('CSV file too large (max 5MB)')
        return file


class CSVFlashcardSerializer(serializers.ModelSerializer):
    class Meta:
        model = CSVFlashcard
        fields = '__all__'
        read_only_fields = [
            'user', 'source', 'last_reviewed', 'times_shown', 'next_review_at'
        ]


class ReviewSerializer(serializers.Serializer):
    # SM-2 quality response 0..5
    quality = serializers.IntegerField(min_value=0, max_value=5)
