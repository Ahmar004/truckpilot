import math
import zlib
from datetime import UTC, datetime, timedelta

import pytest
from django.core import signing
from synthetic import straight_track, track_through

from core.constants import (
    BUNDLE_SALT,
    BUNDLE_SIMPLIFY_M,
    BUNDLE_VERSION,
    ErrorCode,
    LoadUnit,
    RouteSource,
)
from core.errors import BundleInvalid
from planning.bundle import make_bundle, read_bundle
from planning.plan import PlaceInfo, PlanInputs

DEP = datetime(2026, 11, 3, 19, 0, tzinfo=UTC)
NOW = DEP - timedelta(days=1)
ORIGIN = PlaceInfo("Chicago, IL, USA", 41.8781, -87.6298, "America/Chicago")
DEST = PlaceInfo("Dallas, TX, USA", 32.7767, -96.797, "America/Chicago")
INPUTS = PlanInputs(
    origin=ORIGIN,
    destination=DEST,
    departure_utc=DEP,
    load_lb=30_000,
    load_value=13_608,
    load_unit=LoadUnit.KG,
    interval="auto",
    hos=True,
)


def wiggly(n, order=0, source=RouteSource.API, time_factor=1.0):
    points = [
        (38.0 + 0.002 * math.sin(k / 15) + k * 0.0003, -98.0 + k * 0.0009 + 0.001 * math.cos(k / 9))
        for k in range(n)
    ]
    return track_through(points, time_factor=time_factor, source=source, order=order)


def tracks():
    return [
        wiggly(800, 0),
        wiggly(800, 1, RouteSource.API, 1.1),
        wiggly(800, 2, RouteSource.DETOUR, 1.3),
    ]


def test_round_trip_gives_the_same_inputs_and_tracks():
    token, kept = make_bundle(42, INPUTS, NOW, tracks())
    bundle = read_bundle(token, 42)
    assert bundle.inputs == INPUTS
    assert bundle.now_utc == NOW
    assert bundle.tracks == kept
    assert [t.order for t in bundle.tracks] == [0, 1, 2]
    assert [t.source for t in bundle.tracks] == [
        RouteSource.API,
        RouteSource.API,
        RouteSource.DETOUR,
    ]


def test_a_fixed_interval_round_trips():
    inputs = PlanInputs(**{**INPUTS.__dict__, "interval": 25, "hos": False})
    token, _ = make_bundle(1, inputs, NOW, tracks())
    assert read_bundle(token, 1).inputs == inputs


def test_the_kept_tracks_are_simplified_and_keep_their_ends():
    raw = tracks()
    _, kept = make_bundle(1, INPUTS, NOW, raw)
    for before, after in zip(raw, kept, strict=True):
        assert len(after.points) < len(before.points)
        assert after.dist_m[-1] == pytest.approx(before.dist_m[-1], abs=1)
        assert after.driving_s == pytest.approx(before.driving_s, abs=1)
        # Precision 5 moves a coordinate by at most 0.5e-5 degree.
        assert after.points[0] == pytest.approx(before.points[0], abs=0.6e-5)
        assert after.points[-1] == pytest.approx(before.points[-1], abs=0.6e-5)


def test_the_kept_tracks_use_the_20_m_tolerance():
    assert BUNDLE_SIMPLIFY_M == 20
    straight = straight_track(100, step_mi=1.0)
    _, kept = make_bundle(1, INPUTS, NOW, [straight])
    assert len(kept[0].points) == 2


def test_tracks_match_a_polyline_of_precision_5():
    _, kept = make_bundle(1, INPUTS, NOW, tracks())
    for track in kept:
        for lat, lon in track.points:
            assert lat == round(lat, 5)
            assert lon == round(lon, 5)


def test_a_tampered_token_is_refused():
    token, _ = make_bundle(1, INPUTS, NOW, tracks())
    middle = len(token) // 2
    tampered = token[:middle] + ("A" if token[middle] != "A" else "B") + token[middle + 1 :]
    with pytest.raises(BundleInvalid) as caught:
        read_bundle(tampered, 1)
    assert caught.value.code == ErrorCode.INVALID_BUNDLE
    assert caught.value.status == 400


def test_a_truncated_token_is_refused():
    token, _ = make_bundle(1, INPUTS, NOW, tracks())
    with pytest.raises(BundleInvalid):
        read_bundle(token[:-10], 1)


def test_garbage_is_refused():
    for token in ("", "not a token", "a:b:c"):
        with pytest.raises(BundleInvalid):
            read_bundle(token, 1)


def test_a_bundle_of_another_user_is_refused():
    token, _ = make_bundle(1, INPUTS, NOW, tracks())
    with pytest.raises(BundleInvalid):
        read_bundle(token, 2)


def test_a_token_signed_with_another_salt_is_refused():
    payload = {"v": BUNDLE_VERSION}
    token = signing.dumps(payload, salt="something-else", compress=True)
    with pytest.raises(BundleInvalid):
        read_bundle(token, 1)


def good_payload():
    token, _ = make_bundle(1, INPUTS, NOW, tracks())
    return signing.loads(token, salt=BUNDLE_SALT)


def sign(payload):
    return signing.dumps(payload, salt=BUNDLE_SALT, compress=True)


def test_the_good_payload_helper_really_reads_back():
    assert read_bundle(sign(good_payload()), 1).inputs == INPUTS


def test_another_version_is_refused():
    payload = good_payload()
    payload["v"] = BUNDLE_VERSION + 1
    with pytest.raises(BundleInvalid):
        read_bundle(sign(payload), 1)


@pytest.mark.parametrize(
    "damage",
    [
        lambda p: p.pop("now"),
        lambda p: p.update(now="2026-11-02T19:00:00"),  # no zone
        lambda p: p.update(now="not a time"),
        lambda p: p["inputs"].update(load_unit="stone"),
        lambda p: p["inputs"].update(interval=33),
        lambda p: p["inputs"].update(hos="yes"),
        lambda p: p["inputs"]["origin"].pop("tz"),
        lambda p: p.update(tracks=[]),
        lambda p: p.update(tracks="nothing"),
        lambda p: p["tracks"][0].update(p="??"),
        lambda p: p["tracks"][0].update(d=p["tracks"][0]["d"][:-1]),
        lambda p: p["tracks"][0].update(s="teleport"),
        lambda p: p["tracks"][0]["t"].__setitem__(1, -5),
        lambda p: p["tracks"][0]["d"].__setitem__(1, "far"),
        lambda p: p.update(tracks=p["tracks"] * 2),
        lambda p: p["tracks"][0]["d"].__setitem__(1, 10**400),
        lambda p: p.update(now="0001-01-01T00:00:00+05:00"),
        lambda p: p.update(v=True),
        lambda p: p["inputs"]["origin"].update(tz="Mars/Olympus"),
        lambda p: p["inputs"]["destination"].update(tz=""),
        lambda p: p["inputs"]["destination"].update(tz="../etc/passwd"),
    ],
)
def test_a_signed_but_malformed_payload_is_refused(damage):
    payload = good_payload()
    damage(payload)
    with pytest.raises(BundleInvalid):
        read_bundle(sign(payload), 1)


def test_a_signed_payload_that_is_not_an_object_is_refused():
    with pytest.raises(BundleInvalid):
        read_bundle(sign([1, 2, 3]), 1)


def test_a_signed_token_with_a_broken_body_is_refused():
    signer = signing.TimestampSigner(salt=BUNDLE_SALT)
    token = signer.sign(zlib.compress(b"nope").hex())
    with pytest.raises(BundleInvalid):
        read_bundle(token, 1)


def test_bundle_size_on_a_long_three_route_plan_stays_small():
    long_tracks = [wiggly(30_000, i) for i in range(3)]
    token, kept = make_bundle(1, INPUTS, NOW, long_tracks)
    assert len(token) < 100_000
    assert read_bundle(token, 1).tracks == kept


def test_a_rebuilt_bundle_keeps_the_tracks_bit_for_bit():
    """An update signs the tracks it read again; they must not be simplified a second time."""
    token, kept = make_bundle(1, INPUTS, NOW, tracks())
    again = make_bundle(1, INPUTS, NOW, read_bundle(token, 1).tracks, simplified=True)[0]
    assert read_bundle(again, 1).tracks == kept
