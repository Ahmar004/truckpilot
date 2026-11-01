"""A browser-like client for the API tests: CSRF enforced, optionally signed in."""

from django.test import Client


class Api:
    def __init__(self, user=None):
        self.client = Client(enforce_csrf_checks=True)
        if user is not None:
            self.client.force_login(user)

    def csrf(self) -> str:
        return self.client.get("/api/csrf").json()["csrf_token"]

    def get(self, path, **query):
        return self.client.get(path, query)

    def post(self, path, body=None, token=True):
        headers = {"HTTP_X_CSRFTOKEN": self.csrf()} if token else {}
        return self.client.post(
            path, data=body if body is not None else {}, content_type="application/json", **headers
        )
