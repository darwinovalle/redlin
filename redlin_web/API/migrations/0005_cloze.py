# Generated manually for Cloze model
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('API', '0004_flashcard_easiness_flashcard_interval_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='Cloze',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('text_with_blank', models.TextField()),
                ('answer', models.CharField(max_length=255)),
                ('context', models.TextField(blank=True, default='')),
                ('source_span', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('document', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='clozes', to='API.document')),
            ],
            options={},
        ),
        migrations.AddIndex(
            model_name='cloze',
            index=models.Index(fields=['document'], name='API_cloze_document_idx'),
        ),
    ]
