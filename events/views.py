from math import radians, cos, sin, asin, sqrt

from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import Count, Q
from rest_framework import generics, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import JSONParser

from .models import Event, RSVP, Announcement, Notification, Profile
from .serializers import (
    EmptySerializer,
    EventSerializer,
    RSVPSerializer,
    AnnouncementSerializer,
    NotificationSerializer,
    UserSerializer,
    SignupSerializer,
    ProfileSerializer,
    ProfileUpdateSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)
from .permissions import (
    IsOrganizerOrReadOnly,
    IsOwnerOrganizerOrReadOnly,
    IsServerOwnerOrReadOnly,
)


# ---------- Auth ----------
class SignupViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = User.objects.all()
    serializer_class = SignupSerializer
    permission_classes = [AllowAny]


class LoginView(ObtainAuthToken):
    permission_classes = [AllowAny]
    authentication_classes = []
    parser_classes = [JSONParser]

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        response = Response(
            {
                "token": token.key,
                "user": UserSerializer(user).data,
            }
        )
        response.set_cookie(
            settings.AUTH_TOKEN_COOKIE_NAME,
            token.key,
            httponly=settings.AUTH_TOKEN_COOKIE_HTTPONLY,
            secure=settings.AUTH_TOKEN_COOKIE_SECURE,
            samesite=settings.AUTH_TOKEN_COOKIE_SAMESITE,
        )
        return response


class LogoutView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EmptySerializer

    def post(self, request):
        token = getattr(request, "auth", None)
        if isinstance(token, Token):
            token.delete()
        elif token:
            Token.objects.filter(key=str(token)).delete()

        response = Response({"detail": "Logged out."}, status=status.HTTP_200_OK)
        response.delete_cookie(
            settings.AUTH_TOKEN_COOKIE_NAME,
            samesite=settings.AUTH_TOKEN_COOKIE_SAMESITE,
        )
        return response


# ---------- Profile ----------
class ProfileViewSet(
    viewsets.GenericViewSet, mixins.RetrieveModelMixin, mixins.UpdateModelMixin
):
    queryset = Profile.objects.select_related("user")
    permission_classes = [IsAuthenticated & IsServerOwnerOrReadOnly]
    serializer_class = ProfileSerializer

    def get_serializer_class(self):
        if self.action in ["update", "partial_update"]:
            return ProfileUpdateSerializer
        return ProfileSerializer

    @action(detail=False, methods=["get"])
    def me(self, request):
        return Response(ProfileSerializer(request.user.profile).data)


# ---------- Events ----------
def haversine_km(lat1, lon1, lat2, lon2):
    # great-circle distance between two points
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    )
    return 2 * R * asin(sqrt(a))


class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    # Write operations require organizer; object writes require owner or staff
    permission_classes = [IsOrganizerOrReadOnly & IsOwnerOrganizerOrReadOnly]

    def perform_create(self, serializer):
        """Set the created_by field to the current user when creating an event."""
        serializer.save(created_by=self.request.user)

    def get_queryset(self):
        qs = Event.objects.all()
        # search / filters (US-4)
        q = self.request.query_params.get("q")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        near_lat = self.request.query_params.get("lat")
        near_lon = self.request.query_params.get("lon")
        radius_km = float(self.request.query_params.get("radius_km", "25.0"))
        mine = self.request.query_params.get("mine")
        created_by = self.request.query_params.get("created_by")

        if q:
            qs = qs.filter(
                Q(title__icontains=q)
                | Q(description__icontains=q)
                | Q(perks__icontains=q)
                | Q(location_name__icontains=q)
                | Q(address__icontains=q)
            )

        if date_from:
            qs = qs.filter(start_time__gte=date_from)
        if date_to:
            qs = qs.filter(start_time__lte=date_to)

        # filter by creator
        user = getattr(self.request, "user", None)
        if mine in {"1", "true", "True"} and user and getattr(user, "is_authenticated", False):
            qs = qs.filter(created_by=user)
        if created_by:
            try:
                qs = qs.filter(created_by_id=int(created_by))
            except ValueError:
                pass

        # filter by current user's RSVP status (e.g., rsvp=going|maybe|not_going)
        rsvp_status = self.request.query_params.get("rsvp")
        if rsvp_status in {RSVP.GOING, RSVP.MAYBE, RSVP.NOT_GOING} and user and getattr(user, "is_authenticated", False):
            qs = qs.filter(rsvps__user=user, rsvps__status=rsvp_status)

        # annotate RSVP counts
        qs = qs.annotate(
            going_count=Count("rsvps", filter=Q(rsvps__status=RSVP.GOING)),
            maybe_count=Count("rsvps", filter=Q(rsvps__status=RSVP.MAYBE)),
            not_going_count=Count("rsvps", filter=Q(rsvps__status=RSVP.NOT_GOING)),
        )

        # simple proximity sort if lat/lon provided
        if near_lat and near_lon:
            lat0, lon0 = float(near_lat), float(near_lon)
            events = list(qs)

            def dist(e):
                if e.latitude is None or e.longitude is None:
                    return float("inf")
                return haversine_km(lat0, lon0, e.latitude, e.longitude)

            events.sort(key=dist)
            if radius_km is not None:
                events = [
                    e
                    for e in events
                    if (
                        e.latitude is not None
                        and e.longitude is not None
                        and dist(e) <= radius_km
                    )
                ]
            return events
        return qs


# ---------- RSVPs ----------
class RSVPViewSet(viewsets.ModelViewSet):
    queryset = RSVP.objects.select_related("event", "user")
    serializer_class = RSVPSerializer
    permission_classes = [IsAuthenticated & IsServerOwnerOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def get_queryset(self):
        qs = super().get_queryset()
        event_id = self.request.query_params.get("event")
        if event_id:
            qs = qs.filter(event_id=event_id)
        return qs


# ---------- Announcements (US-7) ----------
class AnnouncementViewSet(viewsets.ModelViewSet):
    queryset = Announcement.objects.select_related("event", "author")
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAuthenticated & IsServerOwnerOrReadOnly]


# ---------- Notifications ----------
class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated & IsServerOwnerOrReadOnly]

    def get_queryset(self):
        request = getattr(self, "request", None)
        user = getattr(request, "user", None)
        if user and getattr(user, "is_authenticated", False):
            return Notification.objects.filter(user=user).order_by("-created_at")
        return Notification.objects.none()

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.read = True
        notif.save()
        return Response({"status": "ok"})


# ---------- Password reset ----------
class PasswordResetRequestView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = PasswordResetRequestSerializer

    def post(self, request):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save()
        return Response({"detail": "If the email exists, a reset link was sent."})


class PasswordResetConfirmView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = PasswordResetConfirmSerializer

    def post(self, request):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save()
        return Response({"detail": "Password reset successful."})
