(function () {
  "use strict";

  const auth = window.GodsPromisesAuth;
  const UI = window.GodsPromisesUI;
  if (UI && UI.initAuthNav) UI.initAuthNav();

  const params = new URLSearchParams(location.search);
  const nextRaw = params.get("next") || "me.html";
  const next =
    nextRaw.startsWith("http") || nextRaw.includes("://") || nextRaw.startsWith("//")
      ? "me.html"
      : nextRaw.replace(/^\/+/, "") || "me.html";

  const el = {
    status: document.getElementById("auth-status"),
    panel: document.getElementById("auth-panel"),
    signed: document.getElementById("signed-in-panel"),
    welcome: document.getElementById("signed-in-welcome"),
    email: document.getElementById("signed-in-email"),
    signout: document.getElementById("signout-btn"),
    tabSignin: document.getElementById("tab-signin"),
    tabSignup: document.getElementById("tab-signup"),
    formSignin: document.getElementById("form-signin"),
    formSignup: document.getElementById("form-signup"),
  };

  function showStatus(msg, isError) {
    if (!el.status) return;
    el.status.hidden = !msg;
    el.status.textContent = msg || "";
    el.status.classList.toggle("auth-status--error", !!isError);
  }

  function setTab(which) {
    const signin = which === "signin";
    el.tabSignin.setAttribute("aria-selected", signin ? "true" : "false");
    el.tabSignup.setAttribute("aria-selected", signin ? "false" : "true");
    el.formSignin.hidden = !signin;
    el.formSignup.hidden = signin;
    showStatus("");
    document.querySelector(".site-header h1").textContent = signin
      ? "Sign in"
      : "Create account";
  }

  function renderForUser(user) {
    if (user) {
      el.panel.hidden = true;
      el.signed.hidden = false;
      el.welcome.textContent = `Welcome, ${user.displayName || user.email}`;
      el.email.textContent = user.email;
      showStatus("");
    } else {
      el.panel.hidden = false;
      el.signed.hidden = true;
    }
    if (UI && UI.refreshAuthNav) UI.refreshAuthNav();
  }

  el.tabSignin.addEventListener("click", () => setTab("signin"));
  el.tabSignup.addEventListener("click", () => setTab("signup"));

  el.formSignin.addEventListener("submit", async (e) => {
    e.preventDefault();
    showStatus("");
    const email = document.getElementById("signin-email").value;
    const password = document.getElementById("signin-password").value;
    try {
      await auth.signIn({ email, password });
      location.href = next;
    } catch (err) {
      showStatus((err && err.message) || "Could not sign in.", true);
    }
  });

  el.formSignup.addEventListener("submit", async (e) => {
    e.preventDefault();
    showStatus("");
    const displayName = document.getElementById("signup-name").value;
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    try {
      await auth.signUp({ email, password, displayName });
      location.href = next;
    } catch (err) {
      showStatus((err && err.message) || "Could not create account.", true);
    }
  });

  el.signout.addEventListener("click", async () => {
    await auth.signOut();
    renderForUser(null);
    setTab("signin");
  });

  auth.onAuthChange(renderForUser);
  renderForUser(auth.getCurrentUser());
  setTab("signin");
})();
