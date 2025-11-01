(function () {
    const API_ROOT = "/api";
    const LOGIN_ENDPOINT = `${API_ROOT}/auth/login/`;
    const LOGOUT_ENDPOINT = `${API_ROOT}/auth/logout/`;
    const PROFILE_ENDPOINT = `${API_ROOT}/profiles/me/`;
    const EVENTS_ENDPOINT = `${API_ROOT}/events/`;
    // Friends (future API; UI degrades gracefully if not available)
    const FRIENDS_ENDPOINT = `${API_ROOT}/friends/`;
    const FRIEND_REQUESTS_ENDPOINT = `${API_ROOT}/friend-requests/`;
    // Messages (future API; UI degrades gracefully if not available)
    const CONVERSATIONS_ENDPOINT = `${API_ROOT}/conversations/`;
    const MESSAGES_ENDPOINT = `${API_ROOT}/messages/`;
    const SIGNUP_ENDPOINT = `${API_ROOT}/signup/`;
    const ANNOUNCEMENTS_ENDPOINT = `${API_ROOT}/announcements/`;

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
                    const redirect = button.dataset.logoutRedirect || "/login/";
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
            const loginUrl = document.body.dataset.loginUrl || "/login/";
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

    function formatDateOnly(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
    }

       function showEventDetailsModal(event) {
           const modalBody = document.getElementById('eventDetailsBody');
           const modalTitle = document.getElementById('eventDetailsModalLabel');
           const modalFooter = document.getElementById('eventDetailsFooter');
       
           if (!modalBody || !modalTitle) return;
       
           // Set modal title
           modalTitle.textContent = event.title;
       
           // Build modal content
           const content = document.createElement('div');
       
           // Timing
           const timing = document.createElement('p');
           timing.className = 'mb-3';
           const start = formatDateTime(event.start_time);
           const end = formatDateTime(event.end_time);
           timing.innerHTML = `<strong>When:</strong> ${end ? `${start} – ${end}` : start}`;
           content.appendChild(timing);
           
           // Organizer
           if (event.created_by && event.created_by.username) {
               const org = document.createElement('p');
               org.className = 'mb-3';
               org.innerHTML = '<strong>Organizer:</strong> ';
               const a = document.createElement('a');
               a.href = `/profile/?user=${event.created_by.id}`;
               a.textContent = event.created_by.username;
               a.className = 'organizer-link';
               org.appendChild(a);
               content.appendChild(org);
           }
       
           // Location
           const location = document.createElement('p');
           location.className = 'mb-3';
           location.innerHTML = `<strong>Where:</strong> ${event.location_name || event.address || 'Location TBA'}`;
           if (event.address && event.address !== event.location_name) {
               location.innerHTML += `<br><small class="text-muted">${event.address}</small>`;
           }
           content.appendChild(location);
       
           // Description
           const description = document.createElement('p');
           description.className = 'mb-3';
           description.innerHTML = `<strong>Description:</strong><br>${event.description || 'No description available.'}`;
           content.appendChild(description);
       
           // Perks
           if (event.perks) {
               const perks = document.createElement('p');
               perks.className = 'mb-3';
               perks.innerHTML = `<strong>Perks:</strong><br>${event.perks}`;
               content.appendChild(perks);
           }
       
           // RSVP Stats
           const stats = document.createElement('p');
           stats.className = 'mb-3';
           const going = event.going_count ?? 0;
           const maybe = event.maybe_count ?? 0;
           const notGoing = event.not_going_count ?? 0;
           stats.innerHTML = `<strong>RSVPs:</strong> Going: <span class="text-success">${going}</span>, Maybe: <span class="text-warning">${maybe}</span>, Not Going: <span style="color:#FC5130;">${notGoing}</span>`;
           content.appendChild(stats);
       
           // Map (if available)
           if (event.latitude && event.longitude) {
               const mapContainer = document.createElement('div');
               mapContainer.className = 'embed-responsive embed-responsive-16by9 mb-3';
               mapContainer.style.borderRadius = '8px';
               mapContainer.style.overflow = 'hidden';
           
               const mapIframe = document.createElement('iframe');
               mapIframe.className = 'embed-responsive-item';
               mapIframe.src = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${event.latitude},${event.longitude}&zoom=15`;
               mapIframe.setAttribute('frameborder', '0');
               mapIframe.setAttribute('style', 'border:0');
               mapIframe.setAttribute('allowfullscreen', '');
               mapIframe.setAttribute('loading', 'lazy');
           
               mapContainer.appendChild(mapIframe);
               content.appendChild(mapContainer);
           }
       
           // Clear and set modal body content
           modalBody.innerHTML = '';
           modalBody.appendChild(content);
       
           // Add RSVP buttons to footer
           const current = event.my_rsvp;
           modalFooter.innerHTML = '';
       
           const btnGroup = document.createElement('div');
           btnGroup.className = 'btn-group btn-group-sm mr-auto';
           btnGroup.setAttribute('role', 'group');
       
           const btnGoing = document.createElement('button');
           btnGoing.className = `btn ${current === 'going' ? 'btn-success' : 'btn-outline-success'}`;
           btnGoing.textContent = 'Going';
           btnGoing.dataset.rsvp = 'going';
       
           const btnMaybe = document.createElement('button');
           btnMaybe.className = `btn ${current === 'maybe' ? 'btn-warning' : 'btn-outline-warning'}`;
           btnMaybe.textContent = 'Maybe';
           btnMaybe.dataset.rsvp = 'maybe';
       
           const btnNot = document.createElement('button');
           btnNot.className = `btn ${current === 'not_going' ? 'btn-secondary' : 'btn-outline-secondary'}`;
           btnNot.textContent = 'Not Going';
           btnNot.dataset.rsvp = 'not_going';
       
           btnGroup.appendChild(btnGoing);
           btnGroup.appendChild(btnMaybe);
           btnGroup.appendChild(btnNot);
           modalFooter.appendChild(btnGroup);
       
           // Add close button
           const btnClose = document.createElement('button');
           btnClose.className = 'btn btn-secondary';
           btnClose.setAttribute('data-dismiss', 'modal');
           btnClose.textContent = 'Close';
           modalFooter.appendChild(btnClose);
           
           // View on Calendar (if already Going)
           if (current === 'going') {
               const calendarBtn = document.createElement('a');
               calendarBtn.href = '/calendar/';
               calendarBtn.className = 'btn btn-link';
               calendarBtn.textContent = '📅 View on Calendar';
               modalFooter.appendChild(calendarBtn);
           }
       
           // Add RSVP click handlers
           [btnGoing, btnMaybe, btnNot].forEach(btn => {
               btn.addEventListener('click', async () => {
                   const prev = btn.textContent;
                   btn.disabled = true;
                   btn.textContent = 'Saving…';
                   try {
                       const resp = await apiFetch(`${API_ROOT}/rsvps/`, {
                           method: 'POST',
                           body: { event: event.id, status: btn.dataset.rsvp }
                       });
                       if (!resp.ok) {
                           const data = await resp.json().catch(() => ({}));
                           showAlert('[data-events-alerts]', flattenErrors(data) || 'Unable to save RSVP.', 'danger');
                       } else {
                           // Close modal and refresh list
                           $('#eventDetailsModal').modal('hide');
                           await loadEventsList();
                           if (btn.dataset.rsvp === 'going') {
                               showAlert('[data-events-alerts]', 'Great! This event has been added to your calendar.', 'success');
                           }
                       }
                   } catch (e) {
                       showAlert('[data-events-alerts]', 'Unable to save RSVP.', 'danger');
                   } finally {
                       btn.disabled = false;
                       btn.textContent = prev;
                   }
               });
           });
       
           // Show the modal
           $('#eventDetailsModal').modal('show');
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

                // Card Header
                const cardHeader = document.createElement("div");
                cardHeader.className = "card-header d-flex justify-content-between align-items-center";
                
                const title = document.createElement("h5");
                title.className = "mb-0";
                   title.style.cursor = "pointer";
                   title.style.color = "inherit";
                title.textContent = event.title;
               
                   // Add click handler to show modal
                   title.addEventListener('click', () => showEventDetailsModal(event));
                
                cardHeader.appendChild(title);

                // Make entire header clickable as well
                cardHeader.style.cursor = 'pointer';
                cardHeader.addEventListener('click', (e) => {
                    // Avoid double-trigger if child already handled
                    if (e.target === cardHeader) {
                        showEventDetailsModal(event);
                    }
                });

                // Card Body
                const cardBody = document.createElement("div");
                cardBody.className = "card-body";
                // Only show the date/time in the card body; details are in the modal
                const timing = document.createElement("p");
                timing.className = "card-subtitle mb-1 text-muted";
                
                // Check if event is on a single day
                const startDate = new Date(event.start_time);
                const endDate = event.end_time ? new Date(event.end_time) : null;
                const isSameDay = endDate && 
                    startDate.getFullYear() === endDate.getFullYear() &&
                    startDate.getMonth() === endDate.getMonth() &&
                    startDate.getDate() === endDate.getDate();
                
                if (isSameDay) {
                    // Single day: show date on one line, time range below
                    const dateStr = formatDateOnly(event.start_time);
                    const startTime = startDate.toLocaleTimeString(undefined, { timeStyle: 'short' });
                    const endTime = endDate.toLocaleTimeString(undefined, { timeStyle: 'short' });
                    timing.innerHTML = `${dateStr}<br><small>${startTime} – ${endTime}</small>`;
                } else {
                    // Multi-day or no end: show date range as before
                    const startDateStr = formatDateOnly(event.start_time);
                    const endDateStr = formatDateOnly(event.end_time);
                    const showRange = endDateStr && endDateStr !== startDateStr;
                    timing.textContent = showRange ? `${startDateStr} – ${endDateStr}` : startDateStr;
                }
                
                cardBody.appendChild(timing);

                // Organizer line
                if (event.created_by && event.created_by.username) {
                    const org = document.createElement('p');
                    org.className = 'mb-1 small';
                    const a = document.createElement('a');
                    a.href = `/profile/?user=${event.created_by.id}`;
                    a.textContent = event.created_by.username;
                    a.className = 'organizer-link';
                    a.addEventListener('click', (e) => { e.stopPropagation(); });
                    org.innerHTML = '<strong>Organizer:</strong> ';
                    org.appendChild(a);
                    cardBody.appendChild(org);
                }

                // View details hint under date
                const detailsRow = document.createElement('div');
                detailsRow.className = 'small details-hint mt-1';
                detailsRow.textContent = 'View details ›';
                detailsRow.style.cursor = 'pointer';
                detailsRow.addEventListener('click', () => showEventDetailsModal(event));
                cardBody.appendChild(detailsRow);

                // Make the whole card body open the modal for convenience
                cardBody.style.cursor = "pointer";
                cardBody.addEventListener('click', () => showEventDetailsModal(event));
                
                card.appendChild(cardHeader);
                card.appendChild(cardBody);
                listContainer.appendChild(card);
            });
        } catch (error) {
            console.error(error);
            showAlert(alerts, "Unable to load events right now. Please try again later.", "danger");
        }
    }

    // ---- My Events (profile_my_events.html) ----
    async function loadMyEventsUI() {
        const listContainer = document.querySelector('[data-my-events-list]');
        const alerts = document.querySelector('[data-my-events-alerts]');
        if (!listContainer) return; // not on page

        async function refresh() {
            listContainer.innerHTML = '<p class="text-muted mb-0">Loading your events…</p>';
            try {
                const resp = await apiFetch(`${EVENTS_ENDPOINT}?mine=1`);
                if (!resp.ok) throw new Error('Failed to fetch my events');
                const payload = await resp.json();
                const events = Array.isArray(payload) ? payload : (payload.results || []);
                listContainer.innerHTML = '';
                if (!events.length) {
                    listContainer.innerHTML = '<p class="text-muted mb-0">You haven\'t created any events yet.</p>';
                    return;
                }

                events.forEach(ev => {
                    const card = document.createElement('div');
                    card.className = 'card mb-2';
                    card.innerHTML = `
                        <div class="card-body d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="mb-1">${ev.title}</h6>
                                <small class="text-muted">${formatDateTime(ev.start_time)}${ev.end_time ? ' – ' + formatDateTime(ev.end_time) : ''}</small>
                            </div>
                            <div class="btn-group btn-group-sm">
                                <a href="/manage/${ev.id}/" class="btn btn-outline-primary">Manage</a>
                                <button class="btn btn-outline-danger" data-delete-event data-id="${ev.id}">Delete</button>
                            </div>
                        </div>`;
                    listContainer.appendChild(card);
                });

                // Bind deletes
                listContainer.querySelectorAll('[data-delete-event]').forEach(btn => {
                    if (btn.dataset.bound === 'true') return;
                    btn.dataset.bound = 'true';
                    btn.addEventListener('click', async () => {
                        const id = btn.dataset.id;
                        const label = btn.textContent;
                        btn.disabled = true; btn.textContent = 'Deleting…';
                        try {
                            const del = await apiFetch(`${EVENTS_ENDPOINT}${id}/`, { method: 'DELETE' });
                            if (del.status !== 204) {
                                const data = await del.json().catch(() => ({}));
                                showAlert(alerts, flattenErrors(data) || 'Unable to delete event.', 'danger');
                            } else {
                                await refresh();
                                showAlert(alerts, 'Event deleted.', 'success');
                            }
                        } catch (e) {
                            showAlert(alerts, 'Unable to delete event.', 'danger');
                        } finally {
                            btn.disabled = false; btn.textContent = label;
                        }
                    });
                });
            } catch (err) {
                console.error(err);
                showAlert(alerts, 'Unable to load your events right now.', 'danger');
            }
        }

        await refresh();
    }

    // ---- Friends UI (profile_friends.html) ----
    async function loadFriendsUI() {
        const friendsList = document.querySelector("[data-friends-list]");
        const incomingList = document.querySelector("[data-incoming-requests]");
        const sendForm = document.querySelector("[data-friend-request-form]");
        const friendsAlerts = document.querySelector("[data-friends-alerts]");
        const incomingAlerts = document.querySelector("[data-friend-incoming-alerts]");
        const sendAlerts = document.querySelector("[data-friend-send-alerts]");
        const filterInput = document.querySelector("[data-friends-filter]");

        // Exit early if not on the friends page
        if (!friendsList && !incomingList && !sendForm) {
            return;
        }

        function renderFriendItem(friend) {
            const li = document.createElement("li");
            li.className = "list-group-item d-flex align-items-center justify-content-between";
            const name = typeof friend === "string" ? friend : (friend.username || friend.name || friend.email || "Friend");
            const left = document.createElement("div");
            left.className = "d-flex align-items-center";
            const avatar = document.createElement("img");
            avatar.className = "rounded-circle mr-2";
            avatar.style.width = "28px";
            avatar.style.height = "28px";
            avatar.style.objectFit = "cover";
            avatar.src = (friend.profile_picture) ? friend.profile_picture : 
                (document.querySelector('[data-profile-picture]')?.src || 
                    (document.querySelector('img[alt="Profile"]')?.src) || 
                    "/static/images/default-avatar.png");
            const label = document.createElement("span");
            label.textContent = name;
            left.appendChild(avatar);
            left.appendChild(label);
            li.appendChild(left);
            return li;
        }

        async function refreshFriends() {
            if (!friendsList) return;
            friendsList.innerHTML = "";
            try {
                const resp = await apiFetch(FRIENDS_ENDPOINT);
                if (!resp.ok) throw new Error("Friends API not available");
                const payload = await resp.json();
                const friends = Array.isArray(payload) ? payload : (payload.results || []);
                if (!friends.length) {
                    friendsList.innerHTML = '<li class="list-group-item text-muted">No friends yet.</li>';
                    return;
                }
                friends.forEach(f => friendsList.appendChild(renderFriendItem(f)));
            } catch (err) {
                console.warn(err);
                showAlert(friendsAlerts, "Friends features aren't enabled yet.", "info");
                if (!friendsList.children.length) {
                    friendsList.innerHTML = '<li class="list-group-item text-muted">No friends to show.</li>';
                }
            }
        }

        async function refreshIncoming() {
            if (!incomingList) return;
            incomingList.innerHTML = "";
            try {
                const resp = await apiFetch(`${FRIEND_REQUESTS_ENDPOINT}?status=pending&direction=incoming`);
                if (!resp.ok) throw new Error("Friend requests API not available");
                const payload = await resp.json();
                const reqs = Array.isArray(payload) ? payload : (payload.results || []);
                if (!reqs.length) {
                    incomingList.innerHTML = '<li class="list-group-item text-muted">No pending requests.</li>';
                    return;
                }
                reqs.forEach(r => {
                    const li = document.createElement("li");
                    li.className = "list-group-item d-flex align-items-center justify-content-between";
                    const name = r.from_user?.username || r.username || r.email || "Unknown";
                    li.innerHTML = `
                        <span>${name}</span>
                        <div class="btn-group btn-group-sm">
                            <button type="button" class="btn btn-outline-success" data-approve-request data-id="${r.id}">Approve</button>
                            <button type="button" class="btn btn-outline-secondary" data-decline-request data-id="${r.id}">Decline</button>
                        </div>
                    `;
                    incomingList.appendChild(li);
                });

                // Bind approve/decline handlers
                incomingList.querySelectorAll("[data-approve-request]").forEach(btn => {
                    btn.addEventListener("click", async () => {
                        const id = btn.dataset.id;
                        try {
                            const resp2 = await apiFetch(`${FRIEND_REQUESTS_ENDPOINT}${id}/approve/`, { method: "POST" });
                            if (!resp2.ok) throw new Error();
                            await refreshFriends();
                            await refreshIncoming();
                        } catch (e) {
                            showAlert(incomingAlerts, "Unable to approve request (feature not enabled).", "warning");
                        }
                    });
                });
                incomingList.querySelectorAll("[data-decline-request]").forEach(btn => {
                    btn.addEventListener("click", async () => {
                        const id = btn.dataset.id;
                        try {
                            const resp2 = await apiFetch(`${FRIEND_REQUESTS_ENDPOINT}${id}/decline/`, { method: "POST" });
                            if (!resp2.ok) throw new Error();
                            await refreshIncoming();
                        } catch (e) {
                            showAlert(incomingAlerts, "Unable to decline request (feature not enabled).", "warning");
                        }
                    });
                });
            } catch (err) {
                console.warn(err);
                showAlert(incomingAlerts, "Friend requests aren't enabled yet.", "info");
                if (!incomingList.children.length) {
                    incomingList.innerHTML = '<li class="list-group-item text-muted">No pending requests.</li>';
                }
            }
        }

        // Send friend request form
        if (sendForm) {
            sendForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                clearAlerts(sendAlerts);
                const submitBtn = sendForm.querySelector("button[type='submit']");
                if (submitBtn) submitBtn.disabled = true;
                const username = sendForm.querySelector("[name='username']")?.value?.trim();
                const email = sendForm.querySelector("[name='email']")?.value?.trim();
                if (!username && !email) {
                    showAlert(sendAlerts, "Please enter a username or email.", "warning");
                    if (submitBtn) submitBtn.disabled = false;
                    return;
                }
                try {
                    const resp = await apiFetch(FRIEND_REQUESTS_ENDPOINT, {
                        method: "POST",
                        body: { username, email }
                    });
                    if (!resp.ok) throw new Error();
                    showAlert(sendAlerts, "Request sent!", "success");
                    sendForm.reset();
                } catch (err) {
                    showAlert(sendAlerts, "Unable to send request (feature not enabled).", "warning");
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }

        // Client-side filter
        if (filterInput && friendsList) {
            filterInput.addEventListener("input", () => {
                const q = filterInput.value.toLowerCase();
                friendsList.querySelectorAll(".list-group-item").forEach(li => {
                    const text = li.textContent.toLowerCase();
                    li.style.display = text.includes(q) ? "" : "none";
                });
            });
        }

        // Initial loads
        await refreshFriends();
        await refreshIncoming();
    }

    // ---- Friends sub-tabs (client-side only) ----
    function initFriendsTabs() {
        const tabsContainer = document.querySelector('[data-friends-tabs]');
        if (!tabsContainer) return; // not on friends page
        const panes = document.querySelectorAll('[data-friends-pane]');
        const links = tabsContainer.querySelectorAll('[data-friends-tab-target]');

        function setActive(target) {
            // toggle nav
            links.forEach(a => {
                const isActive = a.dataset.friendsTabTarget === target;
                a.classList.toggle('active', isActive);
                a.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });
            // toggle panes
            panes.forEach(p => {
                const show = p.dataset.friendsPane === target;
                p.classList.toggle('d-none', !show);
            });
        }

    // Initial from hash or body dataset
    const hash = (window.location.hash || '').replace('#', '');
    const dsDefault = document.body?.dataset?.friendsDefaultTab || 'list';
    const initial = hash.startsWith('friends-') ? hash.replace('friends-', '') : dsDefault;
        setActive(['list','send','incoming'].includes(initial) ? initial : 'list');

        // Click handlers
        links.forEach(a => {
            a.addEventListener('click', (e) => {
                const href = a.getAttribute('href') || '';
                const target = a.dataset.friendsTabTarget;
                if (href.startsWith('#')) {
                    e.preventDefault();
                    if (!target) return;
                    window.location.hash = `friends-${target}`;
                    setActive(target);
                } else {
                    // let browser navigate to the route
                }
            });
        });

        // Hash change (back/forward support)
        window.addEventListener('hashchange', () => {
            const h = (window.location.hash || '').replace('#', '');
            if (h.startsWith('friends-')) {
                const t = h.replace('friends-', '');
                setActive(['list','send','incoming'].includes(t) ? t : 'list');
            }
        });
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
                const redirectTarget = nextParam || form.dataset.redirectSuccess || "/";
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
                    is_organizer: form.querySelector("[name='is_organizer']")?.checked || false,
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
                    const redirectTarget = form.dataset.redirectSuccess || "/login/";
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
            // Add 'loaded' class to parent h4 if it exists
            const parentH4 = el.closest('h4');
            if (parentH4) {
                parentH4.classList.add('loaded');
            }
        });

        const emailDisplay = document.querySelector("[data-profile-email]");
        if (emailDisplay) {
            emailDisplay.textContent = profile.user.email || "Not provided";
        }

        const roleDisplay = document.querySelector("[data-profile-role]");
        if (roleDisplay) {
            roleDisplay.textContent = profile.is_organizer ? "Organizer" : "Guest";
        }

        // Organizer controls on settings page
        const becomeOrganizerBtn = document.querySelector("[data-become-organizer]");
        const resignOrganizerBtn = document.querySelector("[data-resign-organizer]");
        const organizerStatus = document.querySelector("[data-organizer-status]");
        if (becomeOrganizerBtn) {
            // Initialize UI based on current role
            if (profile.is_organizer) {
                becomeOrganizerBtn.classList.add('d-none');
                if (resignOrganizerBtn) resignOrganizerBtn.classList.remove('d-none');
                if (organizerStatus) organizerStatus.textContent = "You are currently an organizer.";
            } else {
                becomeOrganizerBtn.classList.remove('d-none');
                if (resignOrganizerBtn) resignOrganizerBtn.classList.add('d-none');
                if (organizerStatus) organizerStatus.textContent = "You are currently a guest.";

                if (becomeOrganizerBtn.dataset.bound !== 'true') {
                    becomeOrganizerBtn.dataset.bound = 'true';
                    becomeOrganizerBtn.addEventListener('click', async () => {
                        const prevText = becomeOrganizerBtn.textContent;
                        becomeOrganizerBtn.disabled = true;
                        becomeOrganizerBtn.textContent = 'Updating...';
                        try {
                            const resp = await apiFetch(PROFILE_ENDPOINT, {
                                method: 'PATCH',
                                body: { is_organizer: true },
                            });
                            if (!resp.ok) {
                                const data = await resp.json().catch(() => ({}));
                                showAlert(alerts, flattenErrors(data), 'danger');
                                return;
                            }
                            // Update local UI
                            showAlert(alerts, 'You are now an organizer! You can create events.', 'success');
                            if (organizerStatus) organizerStatus.textContent = "You are currently an organizer.";
                            becomeOrganizerBtn.classList.add('d-none');
                            if (roleDisplay) roleDisplay.textContent = 'Organizer';
                        } catch (err) {
                            console.error('Failed to become organizer', err);
                            showAlert(alerts, 'Unable to update organizer status. Please try again.', 'danger');
                        } finally {
                            becomeOrganizerBtn.disabled = false;
                            becomeOrganizerBtn.textContent = prevText;
                        }
                    });
                }
            }
        }

        if (resignOrganizerBtn && resignOrganizerBtn.dataset.bound !== 'true') {
            resignOrganizerBtn.dataset.bound = 'true';
            resignOrganizerBtn.addEventListener('click', async () => {
                const prev = resignOrganizerBtn.textContent;
                resignOrganizerBtn.disabled = true; resignOrganizerBtn.textContent = 'Updating...';
                try {
                    const resp = await apiFetch(PROFILE_ENDPOINT, { method: 'PATCH', body: { is_organizer: false } });
                    if (!resp.ok) {
                        const data = await resp.json().catch(() => ({}));
                        showAlert(alerts, flattenErrors(data), 'danger');
                        return;
                    }
                    showAlert(alerts, 'You are now a guest. You can no longer create events.', 'info');
                    if (organizerStatus) organizerStatus.textContent = 'You are currently a guest.';
                    if (becomeOrganizerBtn) becomeOrganizerBtn.classList.remove('d-none');
                    resignOrganizerBtn.classList.add('d-none');
                    if (roleDisplay) roleDisplay.textContent = 'Guest';
                } catch (e) {
                    showAlert(alerts, 'Unable to update organizer status.', 'danger');
                } finally {
                    resignOrganizerBtn.disabled = false; resignOrganizerBtn.textContent = prev;
                }
            });
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

    // ---- Messages UI (profile_messages.html) ----
    async function loadMessagesUI() {
        const conversationsList = document.querySelector("[data-conversations-list]");
        const messageThread = document.querySelector("[data-message-thread]");
        const messageForm = document.querySelector("[data-message-form]");
        const messageFormContainer = document.querySelector("[data-message-form-container]");
        const threadHeader = document.querySelector("[data-thread-header]");
        const conversationsFilter = document.querySelector("[data-conversations-filter]");
        const messagesAlerts = document.querySelector("[data-messages-alerts]");
        const messageInput = document.querySelector("[data-message-input]");

        // Exit early if not on the messages page
        if (!conversationsList || !messageThread || !messageForm) {
            return;
        }

        let currentConversation = null;
        let conversations = [];

        function formatMessageTime(timestamp) {
            if (!timestamp) return "";
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins < 1) return "Just now";
            if (diffMins < 60) return `${diffMins}m ago`;
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) return `${diffHours}h ago`;
            const diffDays = Math.floor(diffHours / 24);
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString();
        }

        function renderConversationItem(conv) {
            const li = document.createElement("li");
            li.className = "list-group-item list-group-item-action";
            li.style.cursor = "pointer";
            li.dataset.conversationId = conv.id;
            
            const friendName = conv.friend?.username || conv.friend_username || conv.username || "Unknown";
            const lastMsg = conv.last_message?.text || conv.last_message || "No messages yet";
            const lastTime = formatMessageTime(conv.last_message?.timestamp || conv.updated_at);
            const unreadCount = conv.unread_count || 0;
            
            li.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <img src="${conv.friend?.profile_picture || '/static/images/default-avatar.png'}" 
                             class="rounded-circle mr-2" 
                             style="width: 40px; height: 40px; object-fit: cover;"
                             alt="${friendName}">
                        <div>
                            <div class="font-weight-bold">${friendName}</div>
                            <small class="text-muted text-truncate d-block" style="max-width: 180px;">${lastMsg}</small>
                        </div>
                    </div>
                    <div class="text-right">
                        <small class="text-muted d-block">${lastTime}</small>
                        ${unreadCount > 0 ? `<span class="badge badge-primary badge-pill">${unreadCount}</span>` : ''}
                    </div>
                </div>
            `;
            
            li.addEventListener("click", () => loadConversation(conv));
            return li;
        }

        function renderMessage(msg, isOwn) {
            const div = document.createElement("div");
            div.className = `mb-3 d-flex ${isOwn ? 'justify-content-end' : 'justify-content-start'}`;
            
            const bubble = document.createElement("div");
            bubble.className = `p-2 rounded ${isOwn ? 'bg-primary text-white' : 'bg-white border'}`;
            bubble.style.maxWidth = "70%";
            
            const text = document.createElement("p");
            text.className = "mb-1";
            text.textContent = msg.text || msg.message || "";
            
            const time = document.createElement("small");
            time.className = isOwn ? "text-white-50" : "text-muted";
            time.textContent = formatMessageTime(msg.timestamp || msg.created_at);
            
            bubble.appendChild(text);
            bubble.appendChild(time);
            div.appendChild(bubble);
            
            return div;
        }

        async function loadConversations() {
            try {
                const resp = await apiFetch(CONVERSATIONS_ENDPOINT);
                if (!resp.ok) throw new Error("Conversations API not available");
                const payload = await resp.json();
                conversations = Array.isArray(payload) ? payload : (payload.results || []);
                
                conversationsList.innerHTML = "";
                if (!conversations.length) {
                    conversationsList.innerHTML = '<li class="list-group-item text-muted text-center">No conversations yet.</li>';
                    return;
                }
                
                conversations.forEach(conv => {
                    conversationsList.appendChild(renderConversationItem(conv));
                });
            } catch (err) {
                console.warn(err);
                showAlert(messagesAlerts, "Messaging features aren't enabled yet.", "info");
                conversationsList.innerHTML = '<li class="list-group-item text-muted text-center">No conversations to show.</li>';
            }
        }

        async function loadConversation(conv) {
            currentConversation = conv;
            const friendName = conv.friend?.username || conv.friend_username || conv.username || "Unknown";
            threadHeader.textContent = friendName;
            messageThread.innerHTML = "";
            messageFormContainer.classList.remove("d-none");
            
            document.querySelector("[data-recipient-id]").value = conv.friend?.id || conv.friend_id || "";
            
            try {
                const resp = await apiFetch(`${MESSAGES_ENDPOINT}?conversation_id=${conv.id}`);
                if (!resp.ok) throw new Error("Messages API not available");
                const payload = await resp.json();
                const messages = Array.isArray(payload) ? payload : (payload.results || []);
                
                if (!messages.length) {
                    messageThread.innerHTML = '<div class="text-center text-muted mt-5"><p>No messages yet. Start the conversation!</p></div>';
                    return;
                }
                
                messages.forEach(msg => {
                    const isOwn = msg.sender_id === conv.user_id || msg.is_own;
                    messageThread.appendChild(renderMessage(msg, isOwn));
                });
                
                // Scroll to bottom
                messageThread.scrollTop = messageThread.scrollHeight;
            } catch (err) {
                console.warn(err);
                messageThread.innerHTML = '<div class="text-center text-muted mt-5"><p>Unable to load messages (feature not enabled).</p></div>';
            }
        }

        // Send message
        if (messageForm) {
            messageForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                if (!currentConversation) return;
                
                const messageText = messageInput.value.trim();
                if (!messageText) return;
                
                const submitBtn = messageForm.querySelector("button[type='submit']");
                if (submitBtn) submitBtn.disabled = true;
                
                try {
                    const resp = await apiFetch(MESSAGES_ENDPOINT, {
                        method: "POST",
                        body: {
                            conversation_id: currentConversation.id,
                            recipient_id: document.querySelector("[data-recipient-id]").value,
                            text: messageText
                        }
                    });
                    
                    if (!resp.ok) throw new Error();
                    
                    const newMsg = await resp.json();
                    messageThread.appendChild(renderMessage(newMsg, true));
                    messageThread.scrollTop = messageThread.scrollHeight;
                    messageInput.value = "";
                    
                    // Refresh conversations list to update last message
                    await loadConversations();
                } catch (err) {
                    showAlert(messagesAlerts, "Unable to send message (feature not enabled).", "warning");
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
            
            // Auto-resize textarea
            messageInput?.addEventListener("input", function() {
                this.style.height = "auto";
                this.style.height = Math.min(this.scrollHeight, 80) + "px";
            });
        }

        // Filter conversations
        if (conversationsFilter) {
            conversationsFilter.addEventListener("input", () => {
                const q = conversationsFilter.value.toLowerCase();
                conversationsList.querySelectorAll(".list-group-item").forEach(li => {
                    const text = li.textContent.toLowerCase();
                    li.style.display = text.includes(q) ? "" : "none";
                });
            });
        }

        // Initial load
        await loadConversations();
    }

    function bindEventCreateForm() {
        const form = document.querySelector("[data-event-create-form]");
        if (!form) {
            return;
        }
        const alerts = document.querySelector("[data-event-alerts]");
        
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            clearAlerts(alerts);
            
            const submitButton = form.querySelector("button[type='submit']");
            if (submitButton) {
                submitButton.disabled = true;
            }
            
            // Gather form data
            const payload = {
                title: form.querySelector("[name='title']").value,
                description: form.querySelector("[name='description']").value || "",
                perks: form.querySelector("[name='perks']").value || "",
                location_name: form.querySelector("[name='location_name']").value || "",
                address: form.querySelector("[name='address']").value || "",
                start_time: form.querySelector("[name='start_time']").value,
                end_time: form.querySelector("[name='end_time']").value || null,
            };
            
            try {
                const response = await apiFetch(EVENTS_ENDPOINT, {
                    method: "POST",
                    body: payload,
                });
                
                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    showAlert(alerts, flattenErrors(data), "danger");
                    return;
                }
                
                showAlert(alerts, "Event created successfully! Redirecting...", "success");
                setTimeout(() => {
                    window.location.href = "/";
                }, 800);
            } catch (error) {
                console.error("Event creation failed", error);
                showAlert(alerts, "Unable to create event. Please try again.", "danger");
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                }
            }
        });
    }

    function initSettingsFormWarning() {
        const settingsForm = document.querySelector('main form:not([data-logout-button])');
        if (!settingsForm) {
            return;
        }

        let formChanged = false;
        let formSubmitted = false;

        // Track changes to any form input
        const formInputs = settingsForm.querySelectorAll('input, select, textarea');
        formInputs.forEach(input => {
            input.addEventListener('change', () => {
                formChanged = true;
            });
            input.addEventListener('input', () => {
                formChanged = true;
            });
        });

        // Mark form as submitted when submit button is clicked
        settingsForm.addEventListener('submit', () => {
            formSubmitted = true;
        });

        // Warn before leaving if there are unsaved changes
        window.addEventListener('beforeunload', (event) => {
            if (formChanged && !formSubmitted) {
                event.preventDefault();
                event.returnValue = ''; // Required for Chrome
                return ''; // For older browsers
            }
        });
    }

    function applyTheme() {
        // Load saved theme from localStorage and apply it
        const savedTheme = localStorage.getItem('theme') || 'light';
        
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }

    function initThemeToggle() {
        const themeSelect = document.querySelector('select[name="theme"]');
        if (!themeSelect) {
            return;
        }

        // Load saved theme from localStorage
        const savedTheme = localStorage.getItem('theme') || 'light';
        themeSelect.value = savedTheme;

        // Handle theme change
        themeSelect.addEventListener('change', (e) => {
            const theme = e.target.value;
            
            if (theme === 'dark') {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
            
            // Save theme preference
            localStorage.setItem('theme', theme);
        });
    }

    // ---- Event Management (manage_event.html) ----
    async function loadEventManagement() {
        const editForm = document.querySelector('[data-event-edit-form]');
        const announcementForm = document.querySelector('[data-announcement-form]');
        if (!editForm || !announcementForm) return; // not on manage page

        const alerts = document.querySelector('[data-manage-alerts]');
        const pathParts = window.location.pathname.split('/');
        const eventId = pathParts[pathParts.indexOf('manage') + 1];

        if (!eventId) {
            showAlert(alerts, 'Invalid event ID.', 'danger');
            return;
        }

        // Load event details
        try {
            const resp = await apiFetch(`${EVENTS_ENDPOINT}${eventId}/`);
            if (!resp.ok) {
                if (resp.status === 404) {
                    showAlert(alerts, 'Event not found.', 'danger');
                } else if (resp.status === 403) {
                    showAlert(alerts, 'You do not have permission to manage this event.', 'danger');
                } else {
                    showAlert(alerts, 'Unable to load event details.', 'danger');
                }
                return;
            }

            const event = await resp.json();

            // Populate form fields
            editForm.querySelector('[name="title"]').value = event.title || '';
            editForm.querySelector('[name="description"]').value = event.description || '';
            editForm.querySelector('[name="perks"]').value = event.perks || '';
            editForm.querySelector('[name="location_name"]').value = event.location_name || '';
            editForm.querySelector('[name="address"]').value = event.address || '';

            // Convert ISO datetime to datetime-local format (remove Z and milliseconds)
            if (event.start_time) {
                const startLocal = new Date(event.start_time);
                editForm.querySelector('[name="start_time"]').value = 
                    new Date(startLocal.getTime() - startLocal.getTimezoneOffset() * 60000)
                        .toISOString().slice(0, 16);
            }
            if (event.end_time) {
                const endLocal = new Date(event.end_time);
                editForm.querySelector('[name="end_time"]').value = 
                    new Date(endLocal.getTime() - endLocal.getTimezoneOffset() * 60000)
                        .toISOString().slice(0, 16);
            }

            // Populate RSVP counts
            document.querySelector('[data-rsvp-going]').textContent = event.going_count || 0;
            document.querySelector('[data-rsvp-maybe]').textContent = event.maybe_count || 0;
            document.querySelector('[data-rsvp-not-going]').textContent = event.not_going_count || 0;

        } catch (e) {
            console.error(e);
            showAlert(alerts, 'Unable to load event details.', 'danger');
            return;
        }

        // Handle edit form submission
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAlerts(alerts);
            const submitBtn = editForm.querySelector('button[type="submit"]');
            const prevText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';

            const payload = {
                title: editForm.querySelector('[name="title"]').value,
                description: editForm.querySelector('[name="description"]').value || '',
                perks: editForm.querySelector('[name="perks"]').value || '',
                location_name: editForm.querySelector('[name="location_name"]').value || '',
                address: editForm.querySelector('[name="address"]').value || '',
                start_time: editForm.querySelector('[name="start_time"]').value,
                end_time: editForm.querySelector('[name="end_time"]').value || null,
            };

            try {
                const resp = await apiFetch(`${EVENTS_ENDPOINT}${eventId}/`, {
                    method: 'PATCH',
                    body: payload
                });

                if (!resp.ok) {
                    const data = await resp.json().catch(() => ({}));
                    showAlert(alerts, flattenErrors(data) || 'Unable to update event.', 'danger');
                } else {
                    showAlert(alerts, 'Event updated successfully!', 'success');
                }
            } catch (err) {
                console.error(err);
                showAlert(alerts, 'Unable to update event.', 'danger');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = prevText;
            }
        });

        // Handle announcement form submission
        announcementForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAlerts(alerts);
            const submitBtn = announcementForm.querySelector('button[type="submit"]');
            const prevText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';

            const payload = {
                event: parseInt(eventId),
                title: announcementForm.querySelector('[name="title"]').value,
                body: announcementForm.querySelector('[name="body"]').value
            };

            try {
                const resp = await apiFetch(ANNOUNCEMENTS_ENDPOINT, {
                    method: 'POST',
                    body: payload
                });

                if (!resp.ok) {
                    const data = await resp.json().catch(() => ({}));
                    showAlert(alerts, flattenErrors(data) || 'Unable to send announcement.', 'danger');
                } else {
                    showAlert(alerts, 'Announcement sent successfully! Attendees will be notified.', 'success');
                    announcementForm.reset();
                }
            } catch (err) {
                console.error(err);
                showAlert(alerts, 'Unable to send announcement.', 'danger');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = prevText;
            }
        });
    }

    document.addEventListener("DOMContentLoaded", async () => {
        // Apply theme immediately on page load for all pages
        applyTheme();
        
        const authState = await initAuthUI();

        if (
            document.body.dataset.redirectIfAuthenticated === "true" &&
            authState.authenticated
        ) {
            const redirectTarget = document.body.dataset.redirectAuthTarget || "/";
            window.location.replace(redirectTarget);
            return;
        }

        await loadEventsList();
    await loadMyEventsUI();
        await loadFriendsUI();
        await loadMessagesUI();
        initFriendsTabs();
        populateProfile(authState);
        bindLoginForm();
        bindRegisterForm();
        bindEventCreateForm();
        initSettingsFormWarning();
        initThemeToggle();
        loadEventManagement();
    });
})();
