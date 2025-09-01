import pytest
from API.models import User


@pytest.mark.django_db
def test_xp_account_level_progression():
    u = User.objects.create(username='lvl', email='lvl@example.com', password='pwd')
    acc = u.xp_account
    assert acc.level == 1
    acc.xp_total = 1000
    acc.calculate_level()
    assert acc.level == 2
    acc.xp_total = 3000
    acc.calculate_level()
    assert acc.level == 3
