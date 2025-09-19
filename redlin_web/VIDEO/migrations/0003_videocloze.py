# Generated manually for VideoCloze model
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('VIDEO', '0002_alter_video_transcript_text_alter_video_video_id'),
    ]

    operations = [
        migrations.CreateModel(
            name='VideoCloze',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('text_with_blank', models.TextField()),
                ('answer', models.CharField(max_length=255)),
                ('context', models.TextField(blank=True, default='')),
                ('source_span', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('video', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='clozes', to='VIDEO.video')),
            ],
            options={},
        ),
        migrations.AddIndex(
            model_name='videocloze',
            index=models.Index(fields=['video'], name='VIDEO_videoc_video_id_idx'),
        ),
    ]
