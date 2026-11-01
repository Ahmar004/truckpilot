"""Per-user limits and per-provider daily budgets (architecture 6.2, 6.3, 7; spec 4).

Every function takes an optional `now` (UTC) so tests can set the time.
"""

import math
from datetime import UTC, datetime, timedelta

from django.db import connection, transaction
from django.utils import timezone

from accounts.models import User
from core.constants import (
    DAY_WINDOW_MIN,
    HOUR_WINDOW_MIN,
    PLANS_PER_DAY,
    PLANS_PER_HOUR,
    PROVIDER_DAY_KEEP_DAYS,
    SEARCHES_PER_HOUR,
    SECONDS_PER_MINUTE,
    UPDATES_PER_HOUR,
    USAGE_EVENT_KEEP_H,
    ErrorCode,
    Provider,
    UsageKind,
)
from core.errors import ApiError, ProviderBudget, RateLimited, SearchLimited
from usage.models import ProviderDay, UsageEvent


def _wait_min(oldest_at: datetime, window_min: int, now: datetime) -> int:
    """Whole minutes, rounded up, until the oldest event leaves its window."""
    leaves_at = oldest_at + timedelta(minutes=window_min)
    return max(1, math.ceil((leaves_at - now).total_seconds() / SECONDS_PER_MINUTE))


def _record(
    user: User,
    kind: UsageKind,
    windows: list[tuple[int, int]],
    refuse: type[ApiError],
    now: datetime | None,
) -> UsageEvent:
    """Check each (window minutes, limit) for this user and kind, then insert an event.

    The user's row is locked first, so parallel requests are counted one at a time.
    """
    now = now or timezone.now()
    with transaction.atomic():
        try:
            User.objects.select_for_update().get(pk=user.pk)
        except User.DoesNotExist:
            # The account was deleted while this request ran.
            raise ApiError(ErrorCode.NOT_SIGNED_IN, 401) from None
        UsageEvent.objects.filter(
            user=user, at__lte=now - timedelta(hours=USAGE_EVENT_KEEP_H)
        ).delete()
        waits = []
        for window_min, limit in windows:
            since = now - timedelta(minutes=window_min)
            recent = UsageEvent.objects.filter(user=user, kind=kind, at__gt=since)
            ats = list(recent.order_by("at").values_list("at", flat=True))
            if len(ats) >= limit:
                # The event whose leaving brings the count back under the limit.
                waits.append(_wait_min(ats[len(ats) - limit], window_min, now))
        if waits:
            raise refuse(max(waits))
        return UsageEvent.objects.create(user=user, kind=kind, at=now)


def record_plan(user: User, *, now: datetime | None = None) -> UsageEvent:
    """Count one plan: 30 per rolling hour and 100 per rolling 24 h (raises RateLimited)."""
    return _record(
        user,
        UsageKind.PLAN,
        [(HOUR_WINDOW_MIN, PLANS_PER_HOUR), (DAY_WINDOW_MIN, PLANS_PER_DAY)],
        RateLimited,
        now,
    )


def record_update(user: User, *, now: datetime | None = None) -> UsageEvent:
    """Count one interval or HOS change: 120 per rolling hour (raises RateLimited)."""
    return _record(user, UsageKind.UPDATE, [(HOUR_WINDOW_MIN, UPDATES_PER_HOUR)], RateLimited, now)


def record_search(user: User, *, now: datetime | None = None) -> UsageEvent:
    """Count one place search: 300 per rolling hour (raises SearchLimited)."""
    return _record(
        user, UsageKind.SEARCH, [(HOUR_WINDOW_MIN, SEARCHES_PER_HOUR)], SearchLimited, now
    )


def refund(event: UsageEvent) -> None:
    """Give an event back, so a blocked plan is not counted against the driver."""
    event.delete()


_RESERVE_SQL = """
INSERT INTO {table} (provider, day, calls) VALUES (%s, %s, %s)
ON CONFLICT (provider, day) DO UPDATE SET calls = {table}.calls + EXCLUDED.calls
WHERE {table}.calls + EXCLUDED.calls <= %s
RETURNING calls
"""


def reserve(provider: Provider, n: int, *, now: datetime | None = None) -> None:
    """Add `n` calls to today's count for the provider, unless that passes its daily budget.

    One atomic statement, so parallel requests can't both take the last calls. Raises
    ProviderBudget when nothing is reserved.
    """
    if n < 1:
        raise ValueError("n must be at least 1")
    now = now or timezone.now()
    today = now.astimezone(UTC).date()
    budget = provider.daily_budget
    if n > budget:
        raise ProviderBudget(provider.service)
    sql = _RESERVE_SQL.format(table=ProviderDay._meta.db_table)
    with connection.cursor() as cursor:
        cursor.execute(sql, [provider.value, today, n, budget])
        row = cursor.fetchone()
    if row is None:
        raise ProviderBudget(provider.service)
    if row[0] == n:
        # The first reservation of a UTC day: drop old days (the row had no calls before).
        cutoff = today - timedelta(days=PROVIDER_DAY_KEEP_DAYS)
        ProviderDay.objects.filter(day__lt=cutoff).delete()
