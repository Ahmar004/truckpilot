"""The Ninja API (architecture 4). Errors answer {code, service?, retry_after_min?, fields?}."""

from django.http import HttpRequest, JsonResponse
from ninja import NinjaAPI
from ninja.errors import AuthenticationError, HttpError, ValidationError

from api import auth, e2e_mode, places, plans
from api.errors import error_response
from api.security import SignedIn
from core.constants import ErrorCode, FieldCode
from core.errors import ApiError

# Pydantic error types that mean "the field is absent"; every other failure is "invalid".
_MISSING = {"missing"}


# Closest code for a Ninja HttpError by status; anything else is a bad request.
_HTTP_ERROR_CODES = {
    401: ErrorCode.NOT_SIGNED_IN,
    403: ErrorCode.CSRF_FAILED,
}


def _field_codes(errors: list[dict]) -> dict[str, str]:
    """Map each failing field name to a short code."""
    fields: dict[str, str] = {}
    for error in errors:
        names = [part for part in error["loc"] if isinstance(part, str)]
        if names[:1] == ["body"] and len(names) > 2:
            name = names[2]  # the field under the body: "load" for load.value
        else:
            name = names[-1] if names else "body"
        fields[name] = FieldCode.REQUIRED if error["type"] in _MISSING else FieldCode.INVALID
    return fields


def build_api(*, debug: bool, e2e: bool, urls_namespace: str | None = None) -> NinjaAPI:
    """Build the API. Docs only with DEBUG; the test sign-in only with E2E_MODE."""
    api = NinjaAPI(
        title="Truck Pilot API",
        auth=SignedIn(),
        docs_url="/docs" if debug else None,
        openapi_url="/openapi.json" if debug else None,
        urls_namespace=urls_namespace,
    )

    @api.exception_handler(ApiError)
    def api_error(request: HttpRequest, exc: ApiError) -> JsonResponse:
        return error_response(exc)

    @api.exception_handler(ValidationError)
    def validation_error(request: HttpRequest, exc: ValidationError) -> JsonResponse:
        fields = _field_codes(exc.errors)
        return error_response(ApiError(ErrorCode.INVALID_INPUT, 422, fields=fields))

    @api.exception_handler(AuthenticationError)
    def not_signed_in(request: HttpRequest, exc: AuthenticationError) -> JsonResponse:
        return error_response(ApiError(ErrorCode.NOT_SIGNED_IN, 401))

    @api.exception_handler(HttpError)
    def http_error(request: HttpRequest, exc: HttpError) -> JsonResponse:
        # Ninja's own errors (for example a body that is not JSON) get the one error shape.
        status = exc.status_code
        if status == 400:
            status = 422
        code = _HTTP_ERROR_CODES.get(status, ErrorCode.INVALID_INPUT)
        return error_response(ApiError(code, status))

    api.add_router("", auth.router)
    api.add_router("", places.router)
    api.add_router("", plans.router)
    if e2e:
        api.add_router("", e2e_mode.router)
    return api
