"""The E2E_MODE test sign-in (architecture 13). Mounted only when settings.E2E_MODE is on."""

from django.http import HttpRequest
from ninja import Router

from accounts import services
from api.auth import UserAnswer, user_answer
from api.security import csrf_guard
from core.constants import E2E_USER_EMAIL, E2E_USER_NAME, E2E_USER_SUB
from providers.google import GoogleIdentity

router = Router()


@router.post("/test/sign-in", auth=csrf_guard, response=UserAnswer)
def test_sign_in(request: HttpRequest):
    identity = GoogleIdentity(sub=E2E_USER_SUB, email=E2E_USER_EMAIL, name=E2E_USER_NAME)
    return user_answer(services.sign_in(request, identity))
