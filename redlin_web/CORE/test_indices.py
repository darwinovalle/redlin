import pytest
from django.db import connection


EXPECTED_INDEX_SUBSTRINGS = [
    'uniq_space_item',
    'idx_lp_user_next',
    'idx_lp_user_status',
    'uniq_lp_user_item',
]


@pytest.mark.django_db
def test_declared_indexes_present():
    with connection.cursor() as cur:
        cur.execute("PRAGMA index_list('CORE_spaceitem');")
        spaceitem_indexes = [row[1] for row in cur.fetchall()]  # name is 2nd column
        cur.execute("PRAGMA index_list('CORE_corelearningprogress');")
        lp_indexes = [row[1] for row in cur.fetchall()]
    all_names = spaceitem_indexes + lp_indexes
    for expected in EXPECTED_INDEX_SUBSTRINGS:
        assert any(expected in name for name in all_names), f"Missing index containing '{expected}'"
