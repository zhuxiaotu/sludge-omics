(() => {
  "use strict";

  if (Auth.getSession()) {
    const next = new URLSearchParams(location.search).get("next") || "index.html";
    location.replace(next);
    return;
  }

  const form = document.getElementById("login-form");
  const err = document.getElementById("login-error");
  const regForm = document.getElementById("register-form");
  const regErr = document.getElementById("reg-error");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    err.hidden = true;
    const result = Auth.login(
      document.getElementById("login-user").value,
      document.getElementById("login-pass").value,
      document.getElementById("login-remember").checked
    );
    if (!result.ok) {
      err.textContent = result.message;
      err.hidden = false;
      return;
    }
    const next = new URLSearchParams(location.search).get("next") || "index.html";
    location.href = next;
  });

  regForm.addEventListener("submit", (e) => {
    e.preventDefault();
    regErr.hidden = true;
    const result = Auth.register(
      document.getElementById("reg-user").value,
      document.getElementById("reg-pass").value,
      document.getElementById("reg-name").value
    );
    if (!result.ok) {
      regErr.textContent = result.message;
      regErr.hidden = false;
      return;
    }
    regErr.hidden = false;
    regErr.style.color = "#2a5f8f";
    regErr.textContent = "注册成功，请使用新账号登录";
    document.getElementById("login-user").value = document.getElementById("reg-user").value;
    document.getElementById("login-pass").value = "";
    document.getElementById("login-pass").focus();
  });
})();
