"""Sign-in and account deletion (architecture 9)."""

from django.contrib.auth import login, logout
from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.http import HttpRequest
from django.utils import timezone

from accounts.models import Session, User
from providers.google import GoogleIdentity


def sign_in(request: HttpRequest, identity: GoogleIdentity) -> User:
    """Find or create the user by Google ID, refresh name and email, and start a session."""
    Session.objects.filter(expire_date__lt=timezone.now()).delete()
    user, created = User.objects.get_or_create(
        google_sub=identity.sub,
        defaults={
            "email": identity.email,
            "name": identity.name,
            "password": make_password(None),  # unusable: sign-in is Google only
        },
    )
    if not created and (user.email, user.name) != (identity.email, identity.name):
        user.email, user.name = identity.email, identity.name
        user.save(update_fields=["email", "name"])
    login(request, user)
    return user


def delete_account(request: HttpRequest) -> None:
    """Delete the user's sessions and the user (usage events go by cascade), then sign out."""
    user_id = request.user.pk
    with transaction.atomic():
        Session.objects.filter(user_id=user_id).delete()
        User.objects.filter(pk=user_id).delete()
    logout(request)
