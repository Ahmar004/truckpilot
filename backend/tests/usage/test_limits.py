import threading
from datetime import UTC, datetime, timedelta

import pytest
from django.db import connections

from accounts.models import User
from core.constants import (
    PLANS_PER_DAY,
    PLANS_PER_HOUR,
    SEARCHES_PER_HOUR,
    UPDATES_PER_HOUR,
    ErrorCode,
    Provider,
    Service,
    UsageKind,
)
from core.errors import ApiError, ProviderBudget, RateLimited, SearchLimited
from usage import limits
from usage.models import ProviderDay, UsageEvent

NOW = datetime(2026, 11, 3, 15, 0, tzinfo=UTC)

pytestmark = pytest.mark.django_db


def add_events(user, kind, ages_min):
    """Create events that happened `age` minutes before NOW."""
    UsageEvent.objects.bulk_create(
        UsageEvent(user=user, kind=kind, at=NOW - timedelta(minutes=age)) for age in ages_min
    )


def count(user, kind):
    return UsageEvent.objects.filter(user=user, kind=kind).count()


def test_record_plan_inserts_an_event_at_now(user):
    event = limits.record_plan(user, now=NOW)
    assert event.kind == UsageKind.PLAN
    assert event.at == NOW
    assert count(user, UsageKind.PLAN) == 1


def test_31st_plan_in_an_hour_is_rate_limited_with_minutes_to_oldest_leaving(user):
    # The oldest event is 50 min old, so it leaves the hour in 10 min.
    add_events(user, UsageKind.PLAN, [50] + [5] * (PLANS_PER_HOUR - 1))
    with pytest.raises(RateLimited) as caught:
        limits.record_plan(user, now=NOW)
    assert caught.value.status == 429
    assert caught.value.retry_after_min == 10
    assert count(user, UsageKind.PLAN) == PLANS_PER_HOUR


def test_wait_is_rounded_up_to_a_whole_minute(user):
    add_events(user, UsageKind.PLAN, [49.5] + [1] * (PLANS_PER_HOUR - 1))
    with pytest.raises(RateLimited) as caught:
        limits.record_plan(user, now=NOW)
    assert caught.value.retry_after_min == 11


def test_an_event_exactly_an_hour_old_is_outside_the_window(user):
    add_events(user, UsageKind.PLAN, [60] + [1] * (PLANS_PER_HOUR - 1))
    limits.record_plan(user, now=NOW)
    assert count(user, UsageKind.PLAN) == PLANS_PER_HOUR + 1


def test_101st_plan_in_24_hours_is_rate_limited(user):
    # 100 plans, the oldest 20 h ago and none in the last hour: it leaves the day in 4 h.
    add_events(user, UsageKind.PLAN, [20 * 60 - i * 10 for i in range(PLANS_PER_DAY)])
    with pytest.raises(RateLimited) as caught:
        limits.record_plan(user, now=NOW)
    assert caught.value.retry_after_min == 240


def test_when_both_limits_are_hit_the_longer_wait_is_used(user):
    hour_ages = [50] + [10] * (PLANS_PER_HOUR - 1)
    day_ages = [23 * 60] + [3 * 60 + i for i in range(PLANS_PER_DAY - PLANS_PER_HOUR - 1)]
    add_events(user, UsageKind.PLAN, hour_ages + day_ages)
    with pytest.raises(RateLimited) as caught:
        limits.record_plan(user, now=NOW)
    # The hour wait is 10 min; the day wait is 60 min.
    assert caught.value.retry_after_min == 60


def test_121st_update_in_an_hour_is_rate_limited(user):
    add_events(user, UsageKind.UPDATE, [30] * UPDATES_PER_HOUR)
    with pytest.raises(RateLimited) as caught:
        limits.record_update(user, now=NOW)
    assert caught.value.retry_after_min == 30


def test_updates_and_plans_are_counted_separately(user):
    add_events(user, UsageKind.PLAN, [5] * PLANS_PER_HOUR)
    event = limits.record_update(user, now=NOW)
    assert event.kind == UsageKind.UPDATE
    assert count(user, UsageKind.UPDATE) == 1


def test_301st_search_in_an_hour_is_search_limited(user):
    add_events(user, UsageKind.SEARCH, [45] * SEARCHES_PER_HOUR)
    with pytest.raises(SearchLimited) as caught:
        limits.record_search(user, now=NOW)
    assert caught.value.status == 429
    assert caught.value.retry_after_min == 15


def test_limits_are_per_user(user, other_user):
    add_events(user, UsageKind.PLAN, [5] * PLANS_PER_HOUR)
    limits.record_plan(other_user, now=NOW)
    assert count(other_user, UsageKind.PLAN) == 1


def test_recording_a_search_clears_only_this_users_events_older_than_24_hours(user, other_user):
    add_events(user, UsageKind.PLAN, [25 * 60, 23 * 60])
    add_events(user, UsageKind.UPDATE, [30 * 60])
    add_events(other_user, UsageKind.PLAN, [26 * 60])
    limits.record_search(user, now=NOW)
    assert count(user, UsageKind.PLAN) == 1
    assert count(user, UsageKind.UPDATE) == 0
    assert count(user, UsageKind.SEARCH) == 1
    assert count(other_user, UsageKind.PLAN) == 1


def test_recording_a_plan_clears_old_events_too(user):
    add_events(user, UsageKind.SEARCH, [25 * 60])
    limits.record_plan(user, now=NOW)
    assert count(user, UsageKind.SEARCH) == 0


def test_a_refused_plan_records_nothing(user):
    add_events(user, UsageKind.PLAN, [5] * PLANS_PER_HOUR)
    with pytest.raises(RateLimited):
        limits.record_plan(user, now=NOW)
    assert count(user, UsageKind.PLAN) == PLANS_PER_HOUR


def test_refund_deletes_the_event(user):
    event = limits.record_plan(user, now=NOW)
    limits.refund(event)
    assert count(user, UsageKind.PLAN) == 0


def test_reserve_allows_calls_up_to_the_budget_exactly(db):
    limits.reserve(Provider.TOMTOM, 600, now=NOW)
    limits.reserve(Provider.TOMTOM, 50, now=NOW)
    assert ProviderDay.objects.get(provider="tomtom", day=NOW.date()).calls == 650


def test_reserve_refuses_one_over_the_budget_with_the_service(db):
    limits.reserve(Provider.GEOAPIFY, Provider.GEOAPIFY.daily_budget, now=NOW)
    with pytest.raises(ProviderBudget) as caught:
        limits.reserve(Provider.GEOAPIFY, 1, now=NOW)
    assert caught.value.status == 503
    assert caught.value.service == Service.PLACES
    assert ProviderDay.objects.get(provider="geoapify", day=NOW.date()).calls == 2_900


def test_a_refused_reservation_leaves_the_count_unchanged(db):
    limits.reserve(Provider.TOMTOM, 648, now=NOW)
    with pytest.raises(ProviderBudget):
        limits.reserve(Provider.TOMTOM, 4, now=NOW)
    assert ProviderDay.objects.get(provider="tomtom", day=NOW.date()).calls == 648
    limits.reserve(Provider.TOMTOM, 2, now=NOW)


def test_reserve_refuses_more_than_the_whole_budget_on_an_empty_day(db):
    with pytest.raises(ProviderBudget) as caught:
        limits.reserve(Provider.OPENMETEO, 9_501, now=NOW)
    assert caught.value.service == Service.WEATHER
    assert not ProviderDay.objects.exists()


def test_budgets_are_per_provider(db):
    limits.reserve(Provider.TOMTOM, 650, now=NOW)
    limits.reserve(Provider.GEOAPIFY, 1, now=NOW)


def test_budget_resets_on_a_new_utc_day(db):
    just_before = datetime(2026, 11, 3, 23, 59, tzinfo=UTC)
    limits.reserve(Provider.TOMTOM, 650, now=just_before)
    with pytest.raises(ProviderBudget):
        limits.reserve(Provider.TOMTOM, 1, now=just_before)
    limits.reserve(Provider.TOMTOM, 1, now=just_before + timedelta(minutes=2))


def test_first_reservation_of_a_day_deletes_provider_rows_older_than_two_days(db):
    today = NOW.date()
    for age in (1, 2, 3, 10):
        ProviderDay.objects.create(provider="tomtom", day=today - timedelta(days=age), calls=5)
    limits.reserve(Provider.TOMTOM, 1, now=NOW)
    days = set(ProviderDay.objects.values_list("day", flat=True))
    assert days == {today, today - timedelta(days=1), today - timedelta(days=2)}


def test_later_reservations_do_not_run_the_clean_up(db):
    limits.reserve(Provider.TOMTOM, 1, now=NOW)
    ProviderDay.objects.create(provider="tomtom", day=NOW.date() - timedelta(days=9), calls=1)
    limits.reserve(Provider.TOMTOM, 1, now=NOW)
    assert ProviderDay.objects.count() == 2


@pytest.mark.django_db(transaction=True)
def test_parallel_plans_respect_limit(user):
    now = datetime.now(UTC)
    UsageEvent.objects.bulk_create(
        UsageEvent(user=user, kind=UsageKind.PLAN, at=now - timedelta(minutes=5))
        for _ in range(PLANS_PER_HOUR - 2)
    )
    results = []

    def attempt():
        try:
            limits.record_plan(user)
            results.append("ok")
        except RateLimited:
            results.append("limited")
        finally:
            connections.close_all()

    threads = [threading.Thread(target=attempt) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(results) == ["limited"] * 3 + ["ok"] * 2
    assert count(user, UsageKind.PLAN) == PLANS_PER_HOUR


def test_a_deleted_account_mid_request_is_not_signed_in(user):
    stale = User.objects.get(pk=user.pk)
    user.delete()
    with pytest.raises(ApiError) as caught:
        limits.record_plan(stale, now=NOW)
    assert (caught.value.code, caught.value.status) == (ErrorCode.NOT_SIGNED_IN, 401)


def test_release_gives_calls_back_to_todays_count(db):
    limits.reserve(Provider.OPENMETEO, 300, now=NOW)
    limits.release(Provider.OPENMETEO, 100, now=NOW)
    assert ProviderDay.objects.get(provider="openmeteo", day=NOW.date()).calls == 200
    # The freed calls can be reserved again.
    limits.reserve(Provider.OPENMETEO, Provider.OPENMETEO.daily_budget - 200, now=NOW)


def test_release_never_goes_below_zero(db):
    limits.reserve(Provider.OPENMETEO, 5, now=NOW)
    limits.release(Provider.OPENMETEO, 50, now=NOW)
    assert ProviderDay.objects.get(provider="openmeteo", day=NOW.date()).calls == 0


def test_release_only_touches_the_given_provider_and_day(db):
    limits.reserve(Provider.OPENMETEO, 10, now=NOW)
    limits.reserve(Provider.TOMTOM, 10, now=NOW)
    limits.reserve(Provider.OPENMETEO, 10, now=NOW + timedelta(days=1))
    limits.release(Provider.OPENMETEO, 4, now=NOW)
    assert ProviderDay.objects.get(provider="openmeteo", day=NOW.date()).calls == 6
    assert ProviderDay.objects.get(provider="tomtom", day=NOW.date()).calls == 10
    assert (
        ProviderDay.objects.get(provider="openmeteo", day=NOW.date() + timedelta(days=1)).calls
        == 10
    )


def test_release_with_no_row_does_nothing(db):
    limits.release(Provider.OPENMETEO, 5, now=NOW)
    assert ProviderDay.objects.count() == 0


def test_release_needs_at_least_one_call(db):
    with pytest.raises(ValueError):
        limits.release(Provider.OPENMETEO, 0, now=NOW)
