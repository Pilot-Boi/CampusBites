from django.shortcuts import render


def login_page(request):
    return render(request, "login.html")


def register_page(request):
    return render(request, "register.html")


def events_page(request):
    return render(request, "events.html")

def create_event_page(request):
    return render(request, "create_event.html")

def calendar_page(request):
    return render(request, "calendar.html")


def profile_page(request):
    return render(request, "profile.html")

def prof_settings_page(request):
    return render(request, "profile_settings.html")

def prof_friends_page(request):
    return render(request, "profile_friends.html", {"friends_default_tab": "list"})

def prof_friends_send_page(request):
    return render(request, "profile_friends.html", {"friends_default_tab": "send"})

def prof_friends_incoming_page(request):
    return render(request, "profile_friends.html", {"friends_default_tab": "incoming"})

def prof_messages_page(request):
    return render(request, "profile_messages.html")

def my_events_page(request):
    return render(request, "profile_my_events.html")

def manage_event_page(request, event_id):
    return render(request, "manage_event.html", {"event_id": event_id})

def contact_page(request):
    return render(request, "contact.html")


def about_page(request):
    return render(request, "about.html")

