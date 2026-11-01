"""Database session store that fills the session's user_id column (architecture 9)."""

from django.contrib.sessions.backends.db import SessionStore as DbSessionStore

from accounts.models import Session


class SessionStore(DbSessionStore):
    @classmethod
    def get_model_class(cls):
        return Session

    def create_model_instance(self, data):
        instance = super().create_model_instance(data)
        try:
            instance.user_id = int(data.get("_auth_user_id"))
        except (TypeError, ValueError):
            instance.user_id = None
        return instance
