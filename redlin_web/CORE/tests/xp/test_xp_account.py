import pytest
from API.models import User
from CORE.models import CoreXpAward


@pytest.mark.django_db
def test_xp_account_auto_created_on_user_creation():
    user = User.objects.create()
    assert hasattr(user, 'xp_account')
    acc = user.xp_account
    assert acc.level == 1
    assert acc.xp_total == 0


@pytest.mark.django_db
def test_xp_level_boundaries_and_progression():
    user = User.objects.create()
    acc = user.xp_account
    acc.xp_total = 999; acc.calculate_level(); assert acc.level == 1
    acc.xp_total = 1000; acc.calculate_level(); assert acc.level == 2
    acc.xp_total = 2999; acc.calculate_level(); assert acc.level == 2
    acc.xp_total = 3000; acc.calculate_level(); assert acc.level == 3
    acc.xp_total = 0
    acc.add_xp(1000); acc.calculate_level(); assert acc.level == 2
    acc.add_xp(2000); acc.calculate_level(); assert acc.level == 3


@pytest.mark.django_db
def test_xp_add_negative_ignored():
    user = User.objects.create()
    acc = user.xp_account
    acc.xp_total = 500
    acc.add_xp(-100)
    assert acc.xp_total == 500


@pytest.mark.django_db
def test_awards_accumulate_and_level():
    user = User.objects.create()
    acc = user.xp_account
    amounts = [400, 300, 500]
    for a in amounts:
        CoreXpAward.objects.create(user=user, amount=a, reason='test')
        acc.add_xp(a)
    acc.save()
    assert acc.xp_total == sum(amounts)
    assert acc.level == 2
