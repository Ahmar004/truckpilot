"""Sentry scrubbing (architecture 10).

Provider URLs hold API keys in the query string, and requests hold cookies and bodies, so
nothing of that may leave the server. Used by settings.py when SENTRY_DSN is set.
"""

import re

# A URL anywhere in a message; its query string and fragment are cut.
_URL_QUERY = re.compile(r"(https?://[^\s?#\"'<>]*)[?#][^\s\"'<>]*")


def strip_query(text: str) -> str:
    """The text with the query string removed from every URL in it."""
    return _URL_QUERY.sub(r"\1", text)


def before_send(event: dict, hint: dict) -> dict:
    """Drop request data and strip query strings from URLs in exception values."""
    event.pop("request", None)
    event.pop("user", None)
    for entry in (event.get("exception") or {}).get("values") or []:
        if isinstance(entry.get("value"), str):
            entry["value"] = strip_query(entry["value"])
    if isinstance(event.get("message"), str):
        event["message"] = strip_query(event["message"])
    return event


def before_breadcrumb(crumb: dict, hint: dict) -> dict:
    """Strip the query string from an HTTP breadcrumb (its URL can hold a key)."""
    data = crumb.get("data")
    if isinstance(data, dict):
        if isinstance(data.get("url"), str):
            data["url"] = strip_query(data["url"])
        data.pop("http.query", None)
        data.pop("http.fragment", None)
    if isinstance(crumb.get("message"), str):
        crumb["message"] = strip_query(crumb["message"])
    return crumb
