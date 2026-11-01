"""Sign-in, sign-out, the signed-in user, CSRF token and account deletion (architecture 4, 9)."""

from django.contrib.auth import logout
from django.http import HttpRequest
from django.middleware.csrf import get_token
from ninja import Router, Schema, Status

from accounts import services
from api.security import csrf_guard
from core.constants import ErrorCode
from core.errors import ApiError
from providers import google

router = Router()


class CredentialIn(Schema):
    credential: str


class UserOut(Schema):
    name: str
    email: str


class UserAnswer(Schema):
    user: UserOut


class CsrfAnswer(Schema):
    csrf_token: str


def user_answer(user) -> dict:
    return {"user": {"name": user.name, "email": user.email}}


@router.get("/csrf", auth=None, response=CsrfAnswer)
def csrf(request: HttpRequest):
    return {"csrf_token": get_token(request)}


@router.post("/auth/google", auth=csrf_guard, response=UserAnswer)
def sign_in(request: HttpRequest, payload: CredentialIn):
    identity = google.verify(payload.credential)
    user = services.sign_in(request, identity)
    return user_answer(user)


@router.post("/auth/sign-out", response={204: None})
def sign_out(request: HttpRequest):
    logout(request)
    return Status(204, None)


@router.get("/me", auth=None, response=UserAnswer)
def me(request: HttpRequest):
    if not request.user.is_authenticated:
        raise ApiError(ErrorCode.NOT_SIGNED_IN, 401)
    return user_answer(request.user)


@router.post("/account/delete", response={204: None})
def delete_account(request: HttpRequest):
    services.delete_account(request)
    return Status(204, None)
