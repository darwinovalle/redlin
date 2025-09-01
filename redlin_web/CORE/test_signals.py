import pytest
from API.models import User

@pytest.mark.django_db
def test_xp_account_signal_creates_account():
    u = User.objects.create(username='sig', email='s@example.com', password='pwd')
    assert hasattr(u, 'xp_account')
    assert u.xp_account.level == 1
