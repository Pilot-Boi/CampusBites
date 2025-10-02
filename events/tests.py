from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase


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
