from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EventViewSet,
    RSVPViewSet,
    AnnouncementViewSet,
    NotificationViewSet,
    ProfileViewSet,
    SignupViewSet,
    LoginView,
    LogoutView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
)
from .frontend_views import (
    about_page,
    calendar_page,
    contact_page,
    create_event_page,
    events_page,
    login_page,
    profile_page,
    prof_settings_page,
    prof_friends_page,
    prof_friends_send_page,
    prof_friends_incoming_page,
    prof_messages_page,
    register_page,
)
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


router = DefaultRouter()
router.register(r"events", EventViewSet, basename="event")
router.register(r"rsvps", RSVPViewSet, basename="rsvp")
router.register(r"announcements", AnnouncementViewSet, basename="announcement")
router.register(r"notifications", NotificationViewSet, basename="notification")
router.register(r"profiles", ProfileViewSet, basename="profile")
router.register(r"signup", SignupViewSet, basename="signup")

urlpatterns = [
    path("", events_page, name="web-events"),
    path("create/", create_event_page, name="web-create-event"),
    path("login/", login_page, name="web-login"),
    path("register/", register_page, name="web-register"),
    path("about/", about_page, name="web-about"),
    path("contact/", contact_page, name="web-contact"),
    path("calendar/", calendar_page, name="web-calendar"),
    path("profile/", profile_page, name="web-profile"),
    path("profile/settings/", prof_settings_page, name="web-profile-settings"),
    path("profile/friends/", prof_friends_page, name="web-profile-friends"),
    path("profile/friends/send/", prof_friends_send_page, name="web-profile-friends-send"),
    path("profile/friends/incoming/", prof_friends_incoming_page, name="web-profile-friends-incoming"),
    path("profile/messages/", prof_messages_page, name="web-profile-messages"),
    path("api/", include(router.urls)),
    path("api/auth/login/", LoginView.as_view(), name="api-login"),
    path("api/auth/logout/", LogoutView.as_view(), name="api-logout"),
    path(
        "api/password/reset/", PasswordResetRequestView.as_view(), name="password_reset"
    ),
    path(
        "api/password/reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
]
urlpatterns += [
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]
