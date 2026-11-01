"""Error answers for the API: one JSON shape for every error code (architecture 4.2)."""

from django.http import HttpRequest, HttpResponse, JsonResponse

from core.errors import ApiError, CsrfFailed


def error_response(error: ApiError) -> JsonResponse:
    return JsonResponse(error.body(), status=error.status)


def csrf_failure(request: HttpRequest, reason: str = "") -> HttpResponse:
    """Django's CSRF failure view: JSON 403 csrf_failed."""
    return error_response(CsrfFailed())
