# events/signals.py
from django.db.models.signals import post_save, pre_save
from django.contrib.auth import get_user_model
from django.dispatch import receiver
from django.conf import settings
from django.core.mail import send_mail
from rest_framework.authtoken.models import Token

from .models import Profile, Event, RSVP, Announcement, Notification


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_profile_for_user(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)
        Token.objects.get_or_create(user=instance)


def _notify_rsvped(event, summary):
    user_model = get_user_model()
    going_user_ids = RSVP.objects.filter(event=event, status=RSVP.GOING).values_list(
        "user_id", flat=True
    )
    for uid in going_user_ids:
        profile = Profile.objects.filter(user_id=uid).first()
        if profile and profile.notifications_opt_out:
            continue
        Notification.objects.create(
            user_id=uid, event=event, summary=summary, link=""  # optional deep link
        )
        # Email (dev: console backend)
        user = user_model.objects.filter(pk=uid).first()
        if not user:
            continue
        send_mail(
            subject=f"Update for {event.title}",
            message=summary,
            from_email=None,
            recipient_list=[user.email] if user.email else [],
            fail_silently=True,
        )


@receiver(pre_save, sender=Event)
def event_changed(sender, instance: Event, **kwargs):
    if not instance.pk:
        return
    try:
        prev = Event.objects.get(pk=instance.pk)
    except Event.DoesNotExist:
        return
    changed_fields = []
    for fld in [
        "title",
        "description",
        "perks",
        "start_time",
        "end_time",
        "address",
        "latitude",
        "longitude",
        "location_name",
    ]:
        if getattr(prev, fld) != getattr(instance, fld):
            changed_fields.append(fld)
    if changed_fields:
        summary = f"Event '{instance.title}' updated: {', '.join(changed_fields)}"
        # defer sending until after save; a simple approach:
        instance._notify_after_save = summary  # attach attr


@receiver(post_save, sender=Event)
def event_changed_post(sender, instance: Event, created, **kwargs):
    if created:
        return
    summary = getattr(instance, "_notify_after_save", None)
    if summary:
        _notify_rsvped(instance, summary)


@receiver(post_save, sender=Announcement)
def announcement_posted(sender, instance: Announcement, created, **kwargs):
    if created:
        _notify_rsvped(
            instance.event,
            f"New announcement for '{instance.event.title}': {instance.title}",
        )
