from django.shortcuts import render


def login_page(request):
    return render(request, "login.html")


def register_page(request):
    return render(request, "register.html")


def events_page(request):
    return render(request, "events.html")


def calendar_page(request):
    return render(request, "calendar.html")


def profile_page(request):
    return render(request, "profile.html")


def contact_page(request):
    return render(request, "contact.html")


def about_page(request):
    return render(request, "about.html")

