from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import Event, RSVP


class AuthenticationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="alice", password="s3cretpass", email="alice@example.com"
        )

    def test_login_returns_token_and_user_payload(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": "alice", "password": "s3cretpass"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        token = Token.objects.get(user=self.user)
        self.assertEqual(response.data["token"], token.key)
        self.assertEqual(response.data["user"]["username"], "alice")

    def test_logout_revokes_token(self):
        token, _ = Token.objects.get_or_create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        response = self.client.post("/api/auth/logout/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Token.objects.filter(key=token.key).exists())


class OrganizerStatusTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="admin", password="adminpass", email="admin@example.com"
        )
        self.user = User.objects.create_user(
            username="bob", password="bobpass", email="bob@example.com"
        )

    def test_superuser_can_set_organizer_status(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/profiles/{self.user.id}/organizer/",
            {"is_organizer": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.profile.refresh_from_db()
        self.assertTrue(self.user.profile.is_organizer)
        self.assertTrue(response.data.get("is_organizer"))

    def test_regular_user_cannot_set_organizer_status(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            f"/api/profiles/{self.user.id}/organizer/",
            {"is_organizer": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.user.profile.refresh_from_db()
        self.assertFalse(self.user.profile.is_organizer)

    def test_profile_lookup_uses_user_id(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(f"/api/profiles/{self.user.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.user.id)
        self.assertEqual(response.data["user"]["id"], self.user.id)


class RSVPTests(APITestCase):
    def setUp(self):
        self.organizer = User.objects.create_user(
            username="organizer", password="organizerpass", email="org@example.com"
        )
        self.event = Event.objects.create(
            created_by=self.organizer,
            title="Launch Party",
            description="Celebrate the new product",
            perks="snacks",
            start_time=timezone.now(),
            end_time=timezone.now() + timedelta(hours=2),
        )
        self.user = User.objects.create_user(
            username="charlie", password="charliepass", email="charlie@example.com"
        )
        self.other_user = User.objects.create_user(
            username="dana", password="danapass", email="dana@example.com"
        )

    def test_authenticated_user_can_create_rsvp(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/rsvps/",
            {"event": self.event.id, "status": RSVP.GOING},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        rsvp = RSVP.objects.get(event=self.event, user=self.user)
        self.assertEqual(rsvp.status, RSVP.GOING)

    def test_user_cannot_modify_someone_elses_rsvp(self):
        owner_rsvp = RSVP.objects.create(
            event=self.event, user=self.other_user, status=RSVP.MAYBE
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            f"/api/rsvps/{owner_rsvp.id}/",
            {"status": RSVP.GOING},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
