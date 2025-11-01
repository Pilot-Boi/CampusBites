from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.conf import settings
from django.core.mail import send_mail

from rest_framework import serializers

from .models import Profile, Event, RSVP, Announcement, Notification


class EmptySerializer(serializers.Serializer):
    """Serializer with no fields used for schema generation."""


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name"]


class ProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Profile
        fields = ["id", "user", "is_organizer", "notifications_opt_out", "about_me", "profile_picture"]


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ["is_organizer", "notifications_opt_out", "about_me", "profile_picture"]


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    is_organizer = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = User
        fields = ["username", "email", "password", "first_name", "last_name", "is_organizer"]

    def create(self, validated_data):
        pwd = validated_data.pop("password")
        is_organizer = validated_data.pop("is_organizer", False)
        user = User.objects.create(**validated_data)
        user.set_password(pwd)
        user.save()
        # Update the profile's is_organizer field
        if hasattr(user, 'profile'):
            user.profile.is_organizer = is_organizer
            user.profile.save()
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate(self, attrs):
        email = attrs["email"]
        try:
            self.user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Don't leak info
            self.user = None
        return attrs

    def save(self):
        if not self.user:  # noop
            return
        token = PasswordResetTokenGenerator().make_token(self.user)
        uidb64 = urlsafe_base64_encode(force_bytes(self.user.pk))
        reset_link = (
            f"{settings.FRONTEND_BASE_URL}/reset-password?uid={uidb64}&token={token}"
        )
        send_mail(
            subject="Password Reset",
            message=f"Reset your password: {reset_link}",
            from_email=None,
            recipient_list=[self.user.email],
            fail_silently=True,
        )


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField()

    def validate(self, attrs):
        try:
            uid = force_str(urlsafe_base64_decode(attrs["uid"]))
            self.user = User.objects.get(pk=uid)
        except Exception:
            raise serializers.ValidationError("Invalid link.")
        if not PasswordResetTokenGenerator().check_token(self.user, attrs["token"]):
            raise serializers.ValidationError("Invalid or expired token.")
        validate_password(attrs["new_password"], self.user)
        return attrs

    def save(self):
        self.user.set_password(self.validated_data["new_password"])
        self.user.save()


class EventSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    going_count = serializers.IntegerField(read_only=True)
    maybe_count = serializers.IntegerField(read_only=True)
    not_going_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Event
        fields = [
            "id",
            "title",
            "description",
            "perks",
            "start_time",
            "end_time",
            "location_name",
            "address",
            "latitude",
            "longitude",
            "map_link",
            "created_by",
            "updated_at",
            "going_count",
            "maybe_count",
            "not_going_count",
        ]
    read_only_fields = [
            "latitude",
            "longitude",
            "map_link",
            "created_by",
            "updated_at",
            "going_count",
            "maybe_count",
            "not_going_count",
        ]
    def create(self, validated_data):
        user = self.context["request"].user
        if not getattr(user.profile, "is_organizer", False):
            raise serializers.ValidationError("Only organizers can create events.")
        # created_by is set in perform_create in the viewset
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Only organizers who own the event can update
        user = self.context["request"].user
        if instance.created_by != user and not user.is_staff:
            raise serializers.ValidationError("You cannot edit this event.")
        return super().update(instance, validated_data)


class RSVPSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = RSVP
        fields = ["id", "user", "event", "status", "created_at"]
        read_only_fields = ["created_at"]

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class AnnouncementSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model = Announcement
        fields = ["id", "event", "author", "title", "body", "created_at"]

    def create(self, validated_data):
        user = self.context["request"].user
        event = validated_data["event"]
        if event.created_by != user and not user.is_staff:
            raise serializers.ValidationError("Only the event organizer can announce.")
        validated_data["author"] = user
        return super().create(validated_data)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "event", "summary", "link", "created_at", "read"]
        read_only_fields = ["created_at"]
