import pytest
from API.models import User

@pytest.fixture
def user(db):
    return User.objects.create(username='tester', email='t@example.com', password='pwd')
