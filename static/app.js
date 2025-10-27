(function () {
    const API_ROOT = "/api";
    const LOGIN_ENDPOINT = `${API_ROOT}/auth/login/`;
    const LOGOUT_ENDPOINT = `${API_ROOT}/auth/logout/`;
    const PROFILE_ENDPOINT = `${API_ROOT}/profiles/me/`;
    const EVENTS_ENDPOINT = `${API_ROOT}/events/`;
    const SIGNUP_ENDPOINT = `${API_ROOT}/signup/`;

    function apiFetch(url, options = {}) {
        const opts = Object.assign({ method: "GET" }, options);
        opts.credentials = "same-origin";
        const headers = new Headers(opts.headers || {});

        if (opts.body && !(opts.body instanceof FormData) && typeof opts.body !== "string") {
            headers.set("Content-Type", "application/json");
            opts.body = JSON.stringify(opts.body);
        }

        opts.headers = headers;
        return fetch(url, opts);
    }

    function flattenErrors(data) {
        if (!data) {
            return ["An unexpected error occurred."];
        }
        if (typeof data === "string") {
            return [data];
        }
        if (Array.isArray(data)) {
            return data.flat().map((item) => (typeof item === "string" ? item : JSON.stringify(item)));
        }
        return Object.values(data).flatMap(flattenErrors);
    }

    function showAlert(container, messages, variant = "info") {
        const target = typeof container === "string" ? document.querySelector(container) : container;
        if (!target) {
            return;
        }
        const msgs = Array.isArray(messages) ? messages : [messages];
        target.innerHTML = "";
        msgs.filter(Boolean).forEach((message) => {
            const alert = document.createElement("div");
            alert.className = `alert alert-${variant}`;
            alert.setAttribute("role", "alert");
            alert.textContent = message;
            target.appendChild(alert);
        });
    }

    function clearAlerts(container) {
        const target = typeof container === "string" ? document.querySelector(container) : container;
        if (target) {
            target.innerHTML = "";
        }
    }

    function bindLogoutButtons() {
        document.querySelectorAll("[data-logout-button]").forEach((button) => {
            if (button.dataset.bound === "true") {
                return;
            }
            button.dataset.bound = "true";
            button.addEventListener("click", async (event) => {
                event.preventDefault();
                button.disabled = true;
                try {
                    await apiFetch(LOGOUT_ENDPOINT, { method: "POST" });
                } catch (error) {
                    console.error("Logout failed", error);
                } finally {
                    const redirect = button.dataset.logoutRedirect || "/events/login/";
                    window.location.href = redirect;
                }
            });
        });
    }

    async function initAuthUI() {
        const state = { authenticated: false, profile: null };
        let response;
        try {
            response = await apiFetch(PROFILE_ENDPOINT);
        } catch (error) {
            console.error("Failed to reach profile endpoint", error);
        }

        if (response && response.ok) {
            try {
                state.profile = await response.json();
                state.authenticated = true;
            } catch (error) {
                console.error("Invalid profile response", error);
            }
        } else if (response && response.status !== 401) {
            console.error("Unexpected profile response", response.status);
        }

        const authNav = document.querySelector("[data-nav-auth]");
        const guestNav = document.querySelector("[data-nav-guest]");
        const usernameSlot = document.querySelector("[data-nav-username]");

        if (authNav) {
            authNav.classList.toggle("d-none", !state.authenticated);
        }
        if (guestNav) {
            guestNav.classList.toggle("d-none", state.authenticated);
        }
        if (usernameSlot) {
            usernameSlot.textContent = state.authenticated ? state.profile.user.username : "";
        }

        bindLogoutButtons();

        if (!state.authenticated && document.body.dataset.requireAuth === "true") {
            const loginUrl = document.body.dataset.loginUrl || "/events/login/";
            const nextValue = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.replace(`${loginUrl}?next=${nextValue}`);
            return state;
        }

        return state;
    }

    function getNextParam() {
        const params = new URLSearchParams(window.location.search);
        return params.get("next");
    }

    function formatDateTime(value) {
        if (!value) {
            return "";
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return date.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
        });
    }

    async function loadEventsList() {
        const listContainer = document.querySelector("[data-events-list]");
        if (!listContainer) {
            return;
        }
        const alerts = document.querySelector("[data-events-alerts]");

        try {
            const response = await apiFetch(EVENTS_ENDPOINT);
            if (!response.ok) {
                throw new Error(`Failed to fetch events: ${response.status}`);
            }
            const payload = await response.json();
            const events = Array.isArray(payload) ? payload : payload.results || [];
            listContainer.innerHTML = "";

            if (!events.length) {
                const empty = document.createElement("p");
                empty.className = "text-muted";
                empty.textContent = "No events are available yet.";
                listContainer.appendChild(empty);
                return;
            }

            events.forEach((event) => {
                const card = document.createElement("div");
                card.className = "card mb-3 shadow-sm";

                const cardBody = document.createElement("div");
                cardBody.className = "card-body";

                const title = document.createElement("h5");
                title.className = "card-title";
                title.textContent = event.title;

                const timing = document.createElement("p");
                timing.className = "card-subtitle mb-2 text-muted";
                const start = formatDateTime(event.start_time);
                const end = formatDateTime(event.end_time);
                timing.textContent = end ? `${start} – ${end}` : start;

                const description = document.createElement("p");
                description.className = "card-text";
                description.textContent = event.description || "Details coming soon.";

                const location = document.createElement("p");
                location.className = "card-text mb-0";
                location.textContent = event.location_name || event.address || "Location TBA";

                const stats = document.createElement("p");
                stats.className = "card-text mt-2 text-muted";
                const going = event.going_count ?? 0;
                const maybe = event.maybe_count ?? 0;
                const notGoing = event.not_going_count ?? 0;
                stats.textContent = `RSVPs — Going: ${going}, Maybe: ${maybe}, Not Going: ${notGoing}`;

                cardBody.appendChild(title);
                cardBody.appendChild(timing);
                cardBody.appendChild(description);
                cardBody.appendChild(location);
                cardBody.appendChild(stats);
                card.appendChild(cardBody);
                listContainer.appendChild(card);
            });
        } catch (error) {
            console.error(error);
            showAlert(alerts, "Unable to load events right now. Please try again later.", "danger");
        }
    }

    function bindLoginForm() {
        const form = document.querySelector("[data-login-form]");
        if (!form) {
            return;
        }
        const alerts = document.querySelector("[data-login-alerts]");
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            clearAlerts(alerts);
            const submitButton = form.querySelector("button[type='submit']");
            if (submitButton) {
                submitButton.disabled = true;
            }
            const payload = {
                username: form.querySelector("[name='username']").value,
                password: form.querySelector("[name='password']").value,
            };

            try {
                const response = await apiFetch(LOGIN_ENDPOINT, {
                    method: "POST",
                    body: payload,
                });
                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    showAlert(alerts, flattenErrors(data), "danger");
                    return;
                }

                showAlert(alerts, "Logged in successfully. Redirecting…", "success");
                await initAuthUI();
                const nextParam = getNextParam();
                const redirectTarget = nextParam || form.dataset.redirectSuccess || "/events/";
                setTimeout(() => {
                    window.location.href = redirectTarget;
                }, 400);
            } catch (error) {
                console.error("Login request failed", error);
                showAlert(alerts, "Unable to log in. Please try again.", "danger");
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                }
            }
        });
    }

    function bindRegisterForm() {
        const form = document.querySelector("[data-register-form]");
        if (!form) {
            return;
        }
        const alerts = document.querySelector("[data-register-alerts]");
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            clearAlerts(alerts);
            const submitButton = form.querySelector("button[type='submit']");
            if (submitButton) {
                submitButton.disabled = true;
            }

            const payload = {
                username: form.querySelector("[name='username']").value,
                email: form.querySelector("[name='email']").value,
                password: form.querySelector("[name='password']").value,
                first_name: form.querySelector("[name='first_name']")?.value || "",
                last_name: form.querySelector("[name='last_name']")?.value || "",
            };

            try {
                const response = await apiFetch(SIGNUP_ENDPOINT, {
                    method: "POST",
                    body: payload,
                });
                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    showAlert(alerts, flattenErrors(data), "danger");
                    return;
                }

                showAlert(alerts, "Account created! You can now log in.", "success");
                setTimeout(() => {
                    const redirectTarget = form.dataset.redirectSuccess || "/events/login/";
                    window.location.href = redirectTarget;
                }, 600);
            } catch (error) {
                console.error("Registration failed", error);
                showAlert(alerts, "Unable to register right now. Please try again later.", "danger");
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                }
            }
        });
    }

    function populateProfile(authState) {
        const usernameDisplays = document.querySelectorAll("[data-profile-username]");
        if (!usernameDisplays.length) {
            return;
        }
        const alerts = document.querySelector("[data-profile-alerts]");

        if (!authState.authenticated || !authState.profile) {
            showAlert(alerts, "Please log in to view your profile.", "warning");
            return;
        }

        const profile = authState.profile;
        usernameDisplays.forEach(el => {
            el.textContent = profile.user.username;
        });

        const emailDisplay = document.querySelector("[data-profile-email]");
        if (emailDisplay) {
            emailDisplay.textContent = profile.user.email || "Not provided";
        }

        const roleDisplay = document.querySelector("[data-profile-role]");
        if (roleDisplay) {
            roleDisplay.textContent = profile.is_organizer ? "Organizer" : "Guest";
        }

        // Handle profile overview (read-only)
        const aboutMeDisplay = document.querySelector("[data-profile-about]");
        if (aboutMeDisplay && !aboutMeDisplay.tagName.toLowerCase() === 'textarea') {
            aboutMeDisplay.textContent = profile.about_me || "No information provided yet.";
        }

        // Handle settings page (editable)
        const aboutMeTextarea = document.querySelector("textarea[data-profile-about]");
        if (aboutMeTextarea) {
            aboutMeTextarea.value = profile.about_me || "";
        }

        const profilePicture = document.querySelector("[data-profile-picture]");
        if (profilePicture && profile.profile_picture) {
            profilePicture.src = profile.profile_picture;
        }

        // Handle About Me save button in settings
        const aboutMeSaveBtn = document.querySelector("[data-save-about]");
        if (aboutMeSaveBtn && aboutMeTextarea) {
            aboutMeSaveBtn.addEventListener("click", async () => {
                try {
                    const response = await apiFetch(PROFILE_ENDPOINT, {
                        method: "PATCH",
                        body: { about_me: aboutMeTextarea.value }
                    });
                    if (response.ok) {
                        showAlert(alerts, "About Me updated successfully!", "success");
                    } else {
                        showAlert(alerts, "Failed to update About Me. Please try again.", "danger");
                    }
                } catch (error) {
                    console.error("Failed to update About Me", error);
                    showAlert(alerts, "Failed to update About Me. Please try again.", "danger");
                }
            });
        }

        // Handle Profile Picture upload in settings
        const pictureUpload = document.querySelector("#profilePictureUpload");
        const pictureUploadBtn = document.querySelector("[data-upload-picture]");
        if (pictureUpload && pictureUploadBtn) {
            pictureUploadBtn.addEventListener("click", async () => {
                const file = pictureUpload.files[0];
                if (!file) {
                    showAlert(alerts, "Please select a file first.", "warning");
                    return;
                }

                const formData = new FormData();
                formData.append("profile_picture", file);

                try {
                    const response = await apiFetch(PROFILE_ENDPOINT, {
                        method: "PATCH",
                        body: formData
                    });
                    if (response.ok) {
                        const updatedProfile = await response.json();
                        const allProfilePictures = document.querySelectorAll("[data-profile-picture]");
                        if (updatedProfile.profile_picture) {
                            allProfilePictures.forEach(img => {
                                img.src = updatedProfile.profile_picture;
                            });
                        }
                        showAlert(alerts, "Profile picture updated successfully!", "success");
                    } else {
                        showAlert(alerts, "Failed to update profile picture. Please try again.", "danger");
                    }
                } catch (error) {
                    console.error("Failed to update profile picture", error);
                    showAlert(alerts, "Failed to update profile picture. Please try again.", "danger");
                }
            });
        }
    }

    document.addEventListener("DOMContentLoaded", async () => {
        const authState = await initAuthUI();

        if (
            document.body.dataset.redirectIfAuthenticated === "true" &&
            authState.authenticated
        ) {
            const redirectTarget = document.body.dataset.redirectAuthTarget || "/events/";
            window.location.replace(redirectTarget);
            return;
        }

        await loadEventsList();
        populateProfile(authState);
        bindLoginForm();
        bindRegisterForm();
    });
})();
