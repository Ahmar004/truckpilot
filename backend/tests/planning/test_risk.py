from decimal import Decimal

import pytest

from core.constants import Cause, Level
from planning.risk import Rating, rate

D = Decimal


def run(wind="0", rain="0", snow="0", load=0) -> Rating:
    return rate(D(wind), D(rain), D(snow), load)


@pytest.mark.parametrize(
    ("wind", "level"),
    [
        ("24.9", Level.LOW),
        ("25.0", Level.MODERATE),
        ("34.9", Level.MODERATE),
        ("35.0", Level.HIGH),
        ("45.0", Level.SEVERE),
        ("54.9", Level.SEVERE),
        ("55.0", Level.NO_TRAVEL),
    ],
)
def test_wind_band_edges(wind, level):
    assert run(wind=wind).level == level


def test_wind_moderate_has_wind_cause():
    assert run(wind="25.0").causes == (Cause.WIND,)


@pytest.mark.parametrize(
    ("rain", "level"),
    [
        ("0.099", Level.LOW),
        ("0.100", Level.MODERATE),
        ("0.250", Level.HIGH),
        ("0.500", Level.SEVERE),
        ("1.000", Level.SEVERE),
        ("1.001", Level.NO_TRAVEL),
    ],
)
def test_rain_band_edges(rain, level):
    assert run(rain=rain).level == level


@pytest.mark.parametrize(
    ("snow", "level"),
    [
        ("0.499", Level.LOW),
        ("0.500", Level.MODERATE),
        ("1.000", Level.HIGH),
        ("2.000", Level.SEVERE),
        ("3.000", Level.SEVERE),
        ("3.001", Level.NO_TRAVEL),
    ],
)
def test_snow_band_edges(snow, level):
    assert run(snow=snow).level == level


@pytest.mark.parametrize(
    ("wind", "load", "level", "load_rule"),
    [
        ("45.0", 30_001, Level.NO_TRAVEL, True),
        ("45.0", 30_000, Level.SEVERE, False),
        ("35.0", 40_001, Level.SEVERE, True),
        ("35.0", 40_000, Level.HIGH, False),
        ("55.0", 0, Level.NO_TRAVEL, False),
        ("55.0", 80_000, Level.NO_TRAVEL, False),
        ("34.9", 80_000, Level.MODERATE, False),
    ],
)
def test_load_rules(wind, load, level, load_rule):
    rating = run(wind=wind, load=load)
    assert rating.level == level
    assert rating.load_rule is load_rule


def test_tie_across_all_three_causes_keeps_order():
    rating = run(wind="25.0", rain="0.10", snow="0.5")
    assert rating.level == Level.MODERATE
    assert rating.causes == (Cause.WIND, Cause.RAIN, Cause.SNOW)


def test_tie_between_rain_and_snow():
    rating = run(rain="0.30", snow="1.0")
    assert rating.level == Level.HIGH
    assert rating.causes == (Cause.RAIN, Cause.SNOW)


def test_load_rule_with_wind_tied_with_rain():
    rating = run(wind="35.0", rain="0.60", load=40_001)
    assert rating.level == Level.SEVERE
    assert rating.causes == (Cause.WIND, Cause.RAIN)
    assert rating.load_rule is True


def test_load_rule_not_reported_when_snow_outranks_wind():
    rating = run(wind="35.0", snow="3.5", load=40_001)
    assert rating.level == Level.NO_TRAVEL
    assert rating.causes == (Cause.SNOW,)
    assert rating.load_rule is False


@pytest.mark.parametrize(
    ("wind", "rain", "snow"),
    [("0", "0", "0"), ("24.9", "0.099", "0.499")],
)
def test_low_has_no_causes(wind, rain, snow):
    rating = run(wind=wind, rain=rain, snow=snow)
    assert rating.level == Level.LOW
    assert rating.causes == ()
    assert rating.load_rule is False


@pytest.mark.parametrize(
    ("wind", "rain", "snow", "level", "causes", "load_rule"),
    [
        ("20", "0", "0", Level.LOW, (), False),
        ("38", "0", "0", Level.SEVERE, (Cause.WIND,), True),
        ("22", "0.30", "0", Level.HIGH, (Cause.RAIN,), False),
        ("0", "0", "0.6", Level.MODERATE, (Cause.SNOW,), False),
        ("0", "0", "0", Level.LOW, (), False),
    ],
    ids=["A1", "A2", "A3", "A4", "A5"],
)
def test_spec_section_13_rows(wind, rain, snow, level, causes, load_rule):
    rating = run(wind=wind, rain=rain, snow=snow, load=42_000)
    assert rating == Rating(level=level, causes=causes, load_rule=load_rule)


def test_level_values_are_risk_scores():
    assert [level.value for level in Level] == [0, 1, 2, 3, 4]
    assert Level.LOW < Level.NO_TRAVEL


@pytest.mark.parametrize(
    ("level", "code"),
    [
        (Level.LOW, "low"),
        (Level.MODERATE, "moderate"),
        (Level.HIGH, "high"),
        (Level.SEVERE, "severe"),
        (Level.NO_TRAVEL, "no_travel"),
    ],
)
def test_level_codes(level, code):
    assert level.code == code
