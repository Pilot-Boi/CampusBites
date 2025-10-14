from django.db import models

# events/models.py
from django.conf import settings
from django.db import models
from django.utils import timezone


class Profile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )
    is_organizer = models.BooleanField(default=False)
    notifications_opt_out = models.BooleanField(default=False)  # for US-7

    def __str__(self):
        return f"{self.user.username} profile"


class Event(models.Model):
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="events"
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    perks = models.CharField(max_length=200, blank=True)  # "free pizza", etc.
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    location_name = models.CharField(max_length=200, blank=True)
    address = models.CharField(max_length=300, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    map_link = models.URLField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["start_time"]

    def save(self, *args, **kwargs):
        # Auto-build a basic Google Maps link if lat/lon or address exists
        if not self.map_link:
            if self.latitude is not None and self.longitude is not None:
                self.map_link = (
                    f"https://maps.google.com/?q={self.latitude},{self.longitude}"
                )
            elif self.address:
                from urllib.parse import quote_plus

                self.map_link = f"https://maps.google.com/?q={quote_plus(self.address)}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class RSVP(models.Model):
    GOING = "going"
    MAYBE = "maybe"
    NOT_GOING = "not_going"
    STATUS_CHOICES = [
        (GOING, "Going"),
        (MAYBE, "Maybe"),
        (NOT_GOING, "Not Going"),
    ]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="rsvps"
    )
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="rsvps")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "event")

    def __str__(self):
        return f"{self.user} -> {self.event} [{self.status}]"


class Announcement(models.Model):
    """Organizer announcements to RSVP'd attendees (US-7)."""

    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name="announcements"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="announcements"
    )
    title = models.CharField(max_length=200)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)


class Notification(models.Model):
    """In-app notifications delivered to RSVP'd 'Going' users on event update or announcement."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name="notifications"
    )
    summary = models.CharField(max_length=255)
    link = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    read = models.BooleanField(default=False)
