import json
from datetime import UTC, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import pytest
from test_plans import api, clock, keys, make_plan, update_body, world  # noqa: F401

from api import schemas
from core.constants import (
    Cause,
    ErrorCode,
    Level,
    Service,
)
from core.errors import (
    ApiError,
    BundleInvalid,
    CsrfFailed,
    NoRoute,
    ProviderBudget,
    ProviderUnavailable,
    RateLimited,
    SearchLimited,
    SignInFailed,
)
from planning.plan import Checkpoint, Weather

pytestmark = pytest.mark.django_db

ARRIVAL = datetime(2026, 11, 3, 21, 30, tzinfo=UTC)


def checkpoint(**changes) -> Checkpoint:
    base = dict(
        n=4,
        mile=75,
        of_mi=412,
        lat=41.123456789,
        lon=-87.987654321,
        covered_mi=25.0,
        eta_utc=ARRIVAL,
        tz="America/Chicago",
        forecast_utc=ARRIVAL + timedelta(minutes=30),
        weather=Weather(Decimal("38.0"), Decimal("0.050"), Decimal("0.001")),
        level=Level.HIGH,
        causes=(Cause.WIND,),
        load_rule=True,
    )
    base.update(changes)
    return Checkpoint(**base)


def test_times_are_utc_iso_8601_to_the_second_ending_in_z():
    assert schemas.utc_text(ARRIVAL) == "2026-11-03T21:30:00Z"
    assert schemas.utc_text(datetime(2026, 11, 3, 21, 30, 5, 999, tzinfo=UTC)) == (
        "2026-11-03T21:30:05Z"
    )
    eastern = timezone(timedelta(hours=-5))
    assert schemas.utc_text(datetime(2026, 11, 3, 16, 30, tzinfo=eastern)) == "2026-11-03T21:30:00Z"


def test_a_decimal_weather_value_is_a_json_number_at_its_own_digits():
    text = json.dumps(schemas._checkpoint(checkpoint())["weather"])
    assert text == '{"wind_mph": 38.0, "rain_in": 0.05, "snow_in": 0.001}'
    tiny = checkpoint(weather=Weather(Decimal("0.1"), Decimal("0.001"), Decimal("0")))
    assert json.dumps(schemas._checkpoint(tiny)["weather"]) == (
        '{"wind_mph": 0.1, "rain_in": 0.001, "snow_in": 0.0}'
    )


def test_a_checkpoint_carries_level_and_cause_strings_from_the_constants():
    out = schemas._checkpoint(checkpoint())
    assert out["level"] == Level.HIGH.code == "high"
    assert out["causes"] == [Cause.WIND]
    assert json.loads(json.dumps(out))["causes"] == ["wind"]
    assert out["lat"] == 41.12346
    assert out["lon"] == -87.98765
    assert out["eta_utc"] == "2026-11-03T21:30:00Z"
    assert out["forecast_utc"] == "2026-11-03T22:00:00Z"


def test_a_checkpoint_without_weather_data_has_null_weather_and_level():
    out = schemas._checkpoint(checkpoint(weather=None, level=None, causes=(), load_rule=False))
    assert out["weather"] is None
    assert out["level"] is None
    assert out["causes"] == []
    assert out["load_rule"] is False


def test_the_miles_keys_are_the_level_codes_plus_no_data():
    assert set(schemas.MilesOut.model_fields) == {level.code for level in Level} | {"no_data"}


def test_a_plan_request_keeps_the_values_as_typed():
    request = schemas.PlanRequest.model_validate(
        {
            "origin": "a",
            "destination": "b",
            "departure_local": "2026-11-03T13:00",
            "load": {"value": 13_608, "unit": "kg"},
            "interval": 25,
            "hos": False,
        }
    )
    assert (request.load.value, request.load.unit, request.interval, request.hos) == (
        13_608,
        "kg",
        25,
        False,
    )


# The contract the frontend tests read (architecture 13): saved answers of this backend.

FIXTURES = Path(__file__).resolve().parents[3] / "frontend" / "src" / "test" / "fixtures"
REGENERATE = "UPDATE_CONTRACT_FIXTURES"
BUNDLE_PLACEHOLDER = "signed-route-bundle"


def without_token(plan: dict) -> dict:
    """The plan with its bundle swapped for a fixed text: a real one holds the user id and the
    signing time, which change from run to run."""
    assert len(plan["bundle"]) > 100
    return {**plan, "bundle": BUNDLE_PLACEHOLDER}


def error_example(error: ApiError) -> dict:
    return {"status": error.status, "body": error.body()}


def error_examples() -> dict:
    examples = [
        ApiError(ErrorCode.NOT_SIGNED_IN, 401),
        SignInFailed(),
        CsrfFailed(),
        ApiError(ErrorCode.INVALID_INPUT, 422, fields={"load": "load_range"}),
        ApiError(ErrorCode.SAME_PLACE, 422),
        ApiError(ErrorCode.DEPARTURE_PASSED, 422),
        BundleInvalid(),
        RateLimited(14),
        SearchLimited(25),
        ProviderBudget(Service.ROUTING),
        ProviderUnavailable(Service.WEATHER),
        NoRoute(),
    ]
    return {str(e.code): error_example(e) for e in examples}


def render(data: dict) -> bytes:
    return (json.dumps(data, separators=(",", ":")) + "\n").encode()


def contract_files(api, world) -> dict[str, bytes]:  # noqa: F811
    plan = make_plan(api, interval=25, hos=True)
    update = api.post("/api/plans/update", update_body(plan, interval=10, hos=False)).json()
    return {
        "plan-response.json": render(without_token(plan)),
        "update-response.json": render(without_token(update)),
        "errors.json": render(error_examples()),
    }


def test_the_error_examples_cover_every_error_code():
    assert set(error_examples()) == {str(code) for code in ErrorCode}


def test_the_frontend_contract_fixtures_are_current(api, world):  # noqa: F811
    """Fails when a committed fixture differs from what the backend answers now.
    Run with UPDATE_CONTRACT_FIXTURES=1 to write them again."""
    import os

    files = contract_files(api, world)
    if os.environ.get(REGENERATE):
        FIXTURES.mkdir(parents=True, exist_ok=True)
        for name, content in files.items():
            (FIXTURES / name).write_bytes(content)
    for name, content in files.items():
        committed = FIXTURES / name
        assert committed.exists(), f"{name} is missing: run with {REGENERATE}=1"
        assert committed.read_bytes() == content, (
            f"{name} is stale: run `{REGENERATE}=1 uv run pytest tests/api/test_schemas.py`"
        )


def test_the_contract_fixtures_hold_no_secret_or_token(api, world):  # noqa: F811
    for name, content in contract_files(api, world).items():
        text = content.decode()
        for forbidden in ("tt-test-key", "apiKey", "sessionid", "csrftoken", "SECRET"):
            assert forbidden not in text, (name, forbidden)
