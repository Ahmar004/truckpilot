"""Forecast cells: a grid of squares on the map, each with one forecast taken at its centre.

A key reads "<size>:<lat index>:<lon index>", for example "0.1:419:-877" (architecture 3).
"""

import math
from decimal import Decimal


def cell_index(lat: float, lon: float, deg: Decimal) -> tuple[int, int]:
    """The (lat index, lon index) of the cell holding the point.

    A value on an edge goes to the cell that starts there. The division is done in Decimal,
    because 41.9 / 0.1 in floats is 418.99999999999994 and would put the point in the wrong cell.
    """
    return math.floor(Decimal(str(lat)) / deg), math.floor(Decimal(str(lon)) / deg)


def key_of(deg: Decimal, i: int, j: int) -> str:
    return f"{deg}:{i}:{j}"


def cell_key(lat: float, lon: float, deg: Decimal) -> str:
    """The key of the cell holding the point."""
    return key_of(deg, *cell_index(lat, lon, deg))


def cell_centre(key: str) -> tuple[float, float]:
    """The (lat, lon) a cell's forecast is taken at."""
    try:
        size, i, j = key.split(":")
        deg = Decimal(size)
        half = deg / 2
        return float((int(i) * deg) + half), float((int(j) * deg) + half)
    except (ValueError, ArithmeticError):
        raise ValueError(f"not a cell key: {key!r}") from None
