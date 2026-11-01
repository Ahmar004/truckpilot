"""URL conf for tests: the API with E2E_MODE on, plus probe routes that raise API errors."""

from django.urls import path
from ninja import Router, Schema

from api import build_api
from api.security import csrf_guard
from core.constants import Service
from core.errors import ProviderBudget, RateLimited

api = build_api(debug=False, e2e=True, urls_namespace="api-probe")
probe = Router()


class Body(Schema):
    count: int
    label: str


@probe.get("/limited", auth=None)
def limited(request):
    raise RateLimited(14)


@probe.get("/budget", auth=None)
def budget(request):
    raise ProviderBudget(Service.WEATHER)


@probe.post("/body", auth=csrf_guard)
def body(request, payload: Body):
    return {}


api.add_router("/probe", probe)

urlpatterns = [path("api/", api.urls)]
