# Generated manually for Feynman model
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('API', '0005_cloze'),
    ]

    operations = [
        migrations.CreateModel(
            name='Feynman',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('prompt', models.TextField()),
                ('key_points', models.JSONField(default=list)),
                ('reference', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('document', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='feynmans', to='API.document')),
            ],
            options={},
        ),
        migrations.AddIndex(
            model_name='feynman',
            index=models.Index(fields=['document'], name='API_feynman_document_idx'),
        ),
    ]
