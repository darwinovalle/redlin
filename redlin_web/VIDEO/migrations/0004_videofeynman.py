# Generated manually for VideoFeynman model
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('VIDEO', '0003_videocloze'),
    ]

    operations = [
        migrations.CreateModel(
            name='VideoFeynman',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('prompt', models.TextField()),
                ('key_points', models.JSONField(default=list)),
                ('reference', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('video', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='feynmans', to='VIDEO.video')),
            ],
            options={},
        ),
        migrations.AddIndex(
            model_name='videofeynman',
            index=models.Index(fields=['video'], name='VIDEO_videof_video_id_idx'),
        ),
    ]
