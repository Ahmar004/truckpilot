"""Usage counts: per-user events for the limits, and per-provider calls per UTC day."""

from django.conf import settings
from django.db import models

from core.constants import UsageKind


class UsageEvent(models.Model):
    """One plan, update or search by a user, kept 24 h (architecture 3)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    kind = models.CharField(max_length=10, choices=[(k.value, k.value) for k in UsageKind])
    at = models.DateTimeField()

    class Meta:
        db_table = "usage_event"
        indexes = [models.Index(fields=["user", "kind", "at"], name="usage_event_user_kind_at")]


class ProviderDay(models.Model):
    """Calls made to one provider on one UTC day, for the whole app."""

    pk = models.CompositePrimaryKey("provider", "day")
    provider = models.CharField(max_length=20)
    day = models.DateField()
    calls = models.PositiveIntegerField()

    class Meta:
        db_table = "provider_day"
