import pytest

from core.constants import CELL_DEG_CHECKPOINT, CELL_DEGS_HEATMAP
from weather.cells import cell_centre, cell_index, cell_key, key_of

D01, D05, D10, D20 = CELL_DEG_CHECKPOINT, *CELL_DEGS_HEATMAP


def test_key_of_the_architecture_example():
    assert cell_key(41.95, -87.65, D01) == "0.1:419:-877"


def test_float_noise_does_not_move_a_point_across_a_cell_edge():
    # 41.9 / 0.1 is 418.99999999999994 in floats; the cell starting at 41.9 is index 419.
    assert cell_key(41.9, 87.6, D01) == "0.1:419:876"


def test_negative_values_round_down_not_towards_zero():
    assert cell_key(-0.05, -0.05, D01) == "0.1:-1:-1"
    assert cell_key(0.05, 0.05, D01) == "0.1:0:0"


def test_a_value_exactly_on_an_edge_belongs_to_the_cell_that_starts_there():
    assert cell_key(42.0, -88.0, D05) == "0.5:84:-176"
    assert cell_key(41.99, -88.01, D05) == "0.5:83:-177"


def test_heatmap_sizes():
    assert cell_key(41.95, -87.65, D05) == "0.5:83:-176"
    assert cell_key(41.95, -87.65, D10) == "1.0:41:-88"
    assert cell_key(41.95, -87.65, D20) == "2.0:20:-44"


def test_centre_is_the_middle_of_the_cell():
    assert cell_centre("0.1:419:-877") == (41.95, -87.65)
    assert cell_centre("2.0:20:-44") == (41.0, -87.0)
    assert cell_centre("0.5:-1:0") == (-0.25, 0.25)


@pytest.mark.parametrize("lat,lon", [(41.95, -87.65), (0.0, 0.0), (-33.3, 151.2), (60.05, -140.05)])
@pytest.mark.parametrize("deg", [D01, D05, D10, D20])
def test_a_point_is_inside_its_own_cell(lat, lon, deg):
    centre_lat, centre_lon = cell_centre(cell_key(lat, lon, deg))
    half = float(deg) / 2
    assert abs(lat - centre_lat) <= half + 1e-9
    assert abs(lon - centre_lon) <= half + 1e-9


def test_bad_key_is_refused():
    with pytest.raises(ValueError):
        cell_centre("not-a-key")


def test_cell_index_matches_the_key():
    assert cell_index(41.95, -87.65, D05) == (83, -176)
    assert cell_key(41.95, -87.65, D05) == key_of(D05, *cell_index(41.95, -87.65, D05))


def test_key_of_builds_the_key_from_the_index():
    assert key_of(D10, 41, -88) == "1.0:41:-88"
    assert cell_centre(key_of(D10, 41, -88)) == (41.5, -87.5)
