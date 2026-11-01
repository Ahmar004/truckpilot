"""API errors. One shape on the wire: {code, service?, retry_after_min?, fields?}.

The server sends codes; the browser owns the copy (architecture 4.2).
"""

from core.constants import ErrorCode, Service


class ApiError(Exception):
    """An error the API answers with its HTTP status and one JSON body."""

    def __init__(
        self,
        code: ErrorCode,
        status: int,
        *,
        service: Service | None = None,
        retry_after_min: int | None = None,
        fields: dict[str, str] | None = None,
    ) -> None:
        super().__init__(code)
        self.code = code
        self.status = status
        self.service = service
        self.retry_after_min = retry_after_min
        self.fields = fields

    def body(self) -> dict:
        """The JSON body; keys that are None are left out."""
        body: dict = {"code": str(self.code)}
        if self.service is not None:
            body["service"] = str(self.service)
        if self.retry_after_min is not None:
            body["retry_after_min"] = self.retry_after_min
        if self.fields is not None:
            body["fields"] = self.fields
        return body


class RateLimited(ApiError):
    def __init__(self, retry_after_min: int) -> None:
        super().__init__(ErrorCode.RATE_LIMITED, 429, retry_after_min=retry_after_min)


class SearchLimited(ApiError):
    def __init__(self, retry_after_min: int) -> None:
        super().__init__(ErrorCode.SEARCH_LIMITED, 429, retry_after_min=retry_after_min)


class ProviderBudget(ApiError):
    def __init__(self, service: Service) -> None:
        super().__init__(ErrorCode.PROVIDER_BUDGET, 503, service=service)


class ProviderUnavailable(ApiError):
    def __init__(self, service: Service) -> None:
        super().__init__(ErrorCode.PROVIDER_UNAVAILABLE, 502, service=service)


class NoRoute(ApiError):
    def __init__(self) -> None:
        super().__init__(ErrorCode.NO_ROUTE, 422)


class SignInFailed(ApiError):
    def __init__(self) -> None:
        super().__init__(ErrorCode.SIGN_IN_FAILED, 401)


class CsrfFailed(ApiError):
    def __init__(self) -> None:
        super().__init__(ErrorCode.CSRF_FAILED, 403)


class BundleInvalid(ApiError):
    def __init__(self) -> None:
        super().__init__(ErrorCode.INVALID_BUNDLE, 400)
