const API_URL = "http://127.0.0.1:8000/api/v1";

function getAccessToken() {
    return localStorage.getItem("access");
}

function getRefreshToken() {
    return localStorage.getItem("refresh");
}

function saveTokens(access, refresh) {
    localStorage.setItem("access", access);
    if (refresh) {
        localStorage.setItem("refresh", refresh);
    }
}

function clearTokens() {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
}

function postJson(path, body) {
    return fetch(API_URL + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

function sendRequest(path, options) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const access = getAccessToken();
    if (access) {
        headers.Authorization = "Bearer " + access;
    }
    return fetch(API_URL + path, { ...options, headers });
}

let refreshPromise = null;

function refreshAccessToken() {
    if (!refreshPromise) {
        refreshPromise = (async () => {
            const refresh = getRefreshToken();
            if (!refresh) {
                return false;
            }
            const response = await postJson("/auth/refresh/", { refresh });
            if (!response.ok) {
                return false;
            }
            const data = await response.json();
            saveTokens(data.access, data.refresh);
            return true;
        })().finally(() => {
            refreshPromise = null;
        });
    }
    return refreshPromise;
}

async function apiFetch(path, options = {}) {
    let response = await sendRequest(path, options);
    if (response.status === 401 && getRefreshToken()) {
        if (!(await refreshAccessToken())) {
            clearTokens();
        }
        response = await sendRequest(path, options);
    }
    return response;
}

async function getCurrentUser() {
    if (!getAccessToken() && !getRefreshToken()) {
        return null;
    }
    try {
        const response = await apiFetch("/users/me/");
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error(error);
    }
    return null;
}

function currentPage() {
    return location.pathname.split("/").pop() || "index.html";
}

async function requireAuth() {
    const user = await getCurrentUser();
    if (!user) {
        location.replace("login.html?next=" + encodeURIComponent(currentPage()));
        return null;
    }
    return user;
}

async function redirectIfAuthenticated() {
    const user = await getCurrentUser();
    if (user) {
        location.replace("index.html");
    }
    return user;
}

function getNextPage() {
    const next = new URLSearchParams(location.search).get("next");
    return next && /^[\w-]+\.html$/.test(next) ? next : "index.html";
}

function logout() {
    clearTokens();
    location.href = "index.html";
}


function makeLink(text, href) {
    const link = document.createElement("a");
    link.textContent = text;
    link.href = href;
    return link;
}

async function renderNav(user) {
    if (user === undefined) {
        user = await getCurrentUser();
    }
    const nav = document.getElementById("nav");
    nav.innerHTML = "";
    nav.append(makeLink("Маршрути", "index.html"), makeLink("Профіль", "profile.html"));

    const right = document.createElement("div");
    right.className = "nav-right";
    if (user) {
        const name = document.createElement("span");
        name.textContent = user.first_name || user.username;
        const button = document.createElement("button");
        button.textContent = "Вийти";
        button.addEventListener("click", logout);
        right.append(name, button);
    } else {
        right.append(makeLink("Увійти", "login.html"), makeLink("Реєстрація", "register.html"));
    }
    nav.append(right);
}

function formatError(data) {
    if (!data || !data.error) {
        return "Сталася помилка";
    }
    let message = data.error;
    if (data.details) {
        const lines = Object.entries(data.details).map(
            ([field, errors]) => field + ": " + [].concat(errors).join(" ")
        );
        message += "\n" + lines.join("\n");
    }
    return message;
}

function showMessage(element, text, type) {
    element.textContent = text;
    element.className = "message " + type;
    element.hidden = false;
}