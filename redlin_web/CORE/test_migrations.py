import pytest
from django.db import connection

@pytest.mark.django_db
def test_core_migration_applied():
    # Ensure key tables exist
    with connection.cursor() as cur:
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'CORE_%';")
        tables = {r[0] for r in cur.fetchall()}
    assert 'CORE_space' in tables
    assert 'CORE_spaceitem' in tables
