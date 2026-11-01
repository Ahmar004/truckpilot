"""The user and the session (architecture 3 and 9)."""

from django.conf import settings
from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.sessions.base_session import AbstractBaseSession
from django.db import models


class UserManager(models.Manager):
    def get_by_natural_key(self, google_sub: str) -> "User":
        return self.get(google_sub=google_sub)

    def create_user(self, google_sub: str, email: str = "", name: str = "") -> "User":
        user = self.model(google_sub=google_sub, email=email, name=name)
        user.set_unusable_password()
        user.save(using=self._db)
        return user


class User(AbstractBaseUser):
    """A driver. Everything we keep about a person is here (spec 4); there is no password."""

    google_sub = models.CharField(max_length=255, unique=True)
    email = models.EmailField()
    name = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "google_sub"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        db_table = "accounts_user"


class Session(AbstractBaseSession):
    """A database session that also records its user, so one DELETE ends all of a user's."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE
    )

    class Meta(AbstractBaseSession.Meta):
        db_table = "accounts_session"

    @classmethod
    def get_session_store_class(cls):
        from accounts.session_store import SessionStore

        return SessionStore
