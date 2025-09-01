from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('API', '0006_feynman'),
    ]

    operations = [
        migrations.AddField(
            model_name='cloze',
            name='options',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='cloze',
            name='meta',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='cloze',
            name='difficulty',
            field=models.CharField(choices=[('easy', 'Easy'), ('medium', 'Medium'), ('hard', 'Hard')], default='medium', max_length=10),
        ),
    ]
