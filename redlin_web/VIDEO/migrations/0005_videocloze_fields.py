from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('VIDEO', '0004_videofeynman'),
    ]

    operations = [
        migrations.AddField(
            model_name='videocloze',
            name='options',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='videocloze',
            name='meta',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='videocloze',
            name='difficulty',
            field=models.CharField(choices=[('easy', 'Easy'), ('medium', 'Medium'), ('hard', 'Hard')], default='medium', max_length=10),
        ),
    ]
