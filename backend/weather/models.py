"""The shared forecast cache (architecture 3, tech-stack 12). Tied to no user."""

from django.db import models


class ForecastCell(models.Model):
    """One cell's forecast, as fetched from Open-Meteo at `fetched_at`.

    `key` is a cell key (`weather.cells`). The three series are JSON arrays with one entry per
    hour from `start_utc`: a decimal string, or null where Open-Meteo gave no value. Strings keep
    the exact Decimals the rules need.
    """

    key = models.CharField(max_length=40, primary_key=True)
    fetched_at = models.DateTimeField()
    start_utc = models.DateTimeField()
    wind_mph = models.JSONField()
    rain_in = models.JSONField()
    snow_in = models.JSONField()

    class Meta:
        db_table = "forecast_cell"
        indexes = [models.Index(fields=["fetched_at"], name="forecast_cell_fetched_at")]
