import pytest
from API.models import User
from .models import Space


@pytest.mark.django_db
def test_space_creation_defaults():
    user = User.objects.create(username='m1', email='m1@example.com', password='pwd')
    s = Space.objects.create(user=user, name='My Space')
    assert s.visibility == 'private'
    assert s.user_id == user.id
    assert str(s) == 'My Space'
