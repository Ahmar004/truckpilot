"""Where every provider module gets its HTTP transport (architecture 13).

Normally httpx picks its own (None). Tests swap `transport_for` for one that serves saved
answers, and with E2E_MODE the replay transport answers from saved real answers, so no test
ever reaches a provider.
"""

import logging

import httpx
from django.conf import settings

from core.constants import Provider, Service


def transport_for(provider: Provider) -> httpx.MockTransport | None:
    """The transport for a provider's calls, or None for the real network."""
    if settings.E2E_MODE:
        from providers import replay

        return replay.transport(provider)
    return None


def log_failure(
    logger: logging.Logger,
    service: Service,
    exc: Exception | None = None,
    status: int | None = None,
) -> None:
    """Warn that a provider call failed.

    The line holds only the service, the error's type name and the HTTP status (given, or the
    one the error carries). Never the message, the arguments, the traceback or the chain: they
    can hold the request URL, and the URL holds the API key. Without this line the broad
    `except` in the provider modules would hide a programming error without a trace.
    """
    if status is None:
        status = getattr(getattr(exc, "response", None), "status_code", None)
    error = type(exc).__name__ if exc is not None else None
    logger.warning("%s call failed: error=%s status=%s", service, error, status)
