import pytest

from accounts.models import User


@pytest.fixture
def user(db):
    return User.objects.create_user(google_sub="sub-1", email="a@example.com", name="Ann")


@pytest.fixture
def other_user(db):
    return User.objects.create_user(google_sub="sub-2", email="b@example.com", name="Bob")
