(() => {
  "use strict";

  const SESSION_KEY = "genome-analysis-session-v1";
  const USERS_KEY = "genome-analysis-users-v1";

  function ensureDemoUser() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      const users = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(users) || !users.length) {
        localStorage.setItem(
          USERS_KEY,
          JSON.stringify([{ username: "admin", password: "admin123", name: "管理员" }])
        );
      }
    } catch {
      localStorage.setItem(
        USERS_KEY,
        JSON.stringify([{ username: "admin", password: "admin123", name: "管理员" }])
      );
    }
  }

  function getUsers() {
    ensureDemoUser();
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setSession(user, remember) {
    const payload = JSON.stringify({
      username: user.username,
      name: user.name || user.username,
      loginAt: new Date().toISOString(),
    });
    sessionStorage.setItem(SESSION_KEY, payload);
    if (remember) localStorage.setItem(SESSION_KEY, payload);
    else localStorage.removeItem(SESSION_KEY);
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  function login(username, password, remember) {
    const user = getUsers().find(
      (u) => u.username === username.trim() && u.password === password
    );
    if (!user) return { ok: false, message: "用户名或密码错误" };
    setSession(user, remember);
    return { ok: true, user };
  }

  function register(username, password, name) {
    const u = username.trim();
    if (!u || !password) return { ok: false, message: "请填写用户名和密码" };
    if (password.length < 4) return { ok: false, message: "密码至少 4 位" };
    const users = getUsers();
    if (users.some((x) => x.username === u)) {
      return { ok: false, message: "用户名已存在" };
    }
    users.push({ username: u, password, name: (name || u).trim() });
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return { ok: true };
  }

  function requireAuth() {
    const path = location.pathname.split("/").pop() || "index.html";
    if (path === "login.html") return;
    if (!getSession()) {
      location.replace(`login.html?next=${encodeURIComponent(path + location.search)}`);
    }
  }

  function logout() {
    clearSession();
    location.href = "login.html";
  }

  window.Auth = {
    login,
    register,
    logout,
    getSession,
    requireAuth,
    clearSession,
  };

  ensureDemoUser();

  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (page !== "login.html") {
    requireAuth();
  }
})();
