from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsOrganizerOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        profile = getattr(user, "profile", None)
        return bool(profile and profile.is_organizer)


class IsOwnerOrganizerOrReadOnly(BasePermission):
    """For Event modify: only event owner (or staff)."""

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        return user.is_staff or obj.created_by_id == user.id


class IsServerOwnerOrReadOnly(BasePermission):
    """Restrict write operations to the Django site owner (superuser)."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        return bool(user and user.is_authenticated and user.is_superuser)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        return bool(user and user.is_authenticated and user.is_superuser)


class IsRSVPOwnerOrReadOnly(BasePermission):
    """Allow RSVP owners (or superusers) to modify RSVPs, read-only otherwise."""

    def has_permission(self, request, view):
        # Object-level checks handle write protection; allow view-level checks to pass
        return True

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True

        user = request.user
        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        return obj.user_id == user.id
