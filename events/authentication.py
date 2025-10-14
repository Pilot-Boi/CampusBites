from django.conf import settings
from rest_framework.authentication import TokenAuthentication


class CookieTokenAuthentication(TokenAuthentication):
    """Token authentication that also looks for the token in a cookie."""

    def authenticate(self, request):
        # First attempt the standard header-based authentication.
        header_auth = super().authenticate(request)
        if header_auth is not None:
            return header_auth

        cookie_name = getattr(settings, "AUTH_TOKEN_COOKIE_NAME", "auth_token")
        token = request.COOKIES.get(cookie_name)
        if not token:
            return None

        return self.authenticate_credentials(token)
