(function () {
  "use strict";

  const auth = window.GodsPromisesAuth;
  const UI = window.GodsPromisesUI;
  if (UI && UI.initAuthNav) UI.initAuthNav();

  const params = new URLSearchParams(location.search);
  const nextRaw = params.get("next") || "me.html";
  const next = window.GodsPromisesSafeNext(nextRaw, location.href);

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
    formForgot: document.getElementById("form-forgot"),
    formRecovery: document.getElementById("form-recovery"),
    tabs: document.querySelector(".auth-tabs"),
    heading: document.querySelector(".site-header h1"),
  };

  let busy = false;

  function showStatus(msg, isError) {
    if (!el.status) return;
    el.status.hidden = !msg;
    el.status.textContent = msg || "";
    el.status.classList.toggle("auth-status--error", !!isError);
  }

  function setBusy(form, on, label) {
    busy = on;
    if (!form) return;
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    button.disabled = on;
    button.setAttribute("aria-busy", on ? "true" : "false");
    if (on && label) button.dataset.idleLabel = button.dataset.idleLabel || button.textContent;
    if (button.dataset.idleLabel) button.textContent = on ? label : button.dataset.idleLabel;
  }

  function hideForms() {
    el.formSignin.hidden = true;
    el.formSignup.hidden = true;
    el.formForgot.hidden = true;
    el.formRecovery.hidden = true;
  }

  function setTab(which) {
    const signin = which === "signin";
    el.tabs.hidden = false;
    el.tabSignin.setAttribute("aria-selected", signin ? "true" : "false");
    el.tabSignup.setAttribute("aria-selected", signin ? "false" : "true");
    hideForms();
    el.formSignin.hidden = !signin;
    el.formSignup.hidden = signin;
    showStatus("");
    el.heading.textContent = signin ? "Sign in" : "Create account";
  }

  function showForgot() {
    el.tabs.hidden = true;
    hideForms();
    el.formForgot.hidden = false;
    el.heading.textContent = "Reset password";
    showStatus("");
  }

  function showRecovery() {
    el.panel.hidden = false;
    el.signed.hidden = true;
    el.tabs.hidden = true;
    hideForms();
    el.formRecovery.hidden = false;
    el.heading.textContent = "Choose a new password";
    showStatus("Choose a new password for your account.", false);
  }

  function renderForUser(user, meta) {
    if (meta && (meta.event === "PASSWORD_RECOVERY" || meta.recovery) && auth.isPasswordRecovery && auth.isPasswordRecovery()) {
      showRecovery();
      if (UI && UI.refreshAuthNav) UI.refreshAuthNav();
      return;
    }
    if (user) {
      el.panel.hidden = true;
      el.signed.hidden = false;
      el.welcome.textContent = `Welcome, ${user.displayName || user.email}`;
      el.email.textContent = user.email;
      if (!(meta && meta.keepStatus)) showStatus("");
    } else {
      el.panel.hidden = false;
      el.signed.hidden = true;
      if (el.formForgot.hidden && el.formRecovery.hidden) setTab("signin");
    }
    if (UI && UI.refreshAuthNav) UI.refreshAuthNav();
  }

  el.tabSignin.addEventListener("click", () => setTab("signin"));
  el.tabSignup.addEventListener("click", () => setTab("signup"));
  document.getElementById("forgot-link").addEventListener("click", (e) => {
    e.preventDefault();
    showForgot();
  });
  document.getElementById("forgot-cancel").addEventListener("click", () => setTab("signin"));

  el.formSignin.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    showStatus("");
    setBusy(el.formSignin, true, "Signing in…");
    try {
      await auth.signIn({
        email: document.getElementById("signin-email").value,
        password: document.getElementById("signin-password").value,
      });
      location.href = next;
    } catch (err) {
      showStatus((err && err.message) || "Could not sign in.", true);
      setBusy(el.formSignin, false);
    }
  });

  el.formSignup.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    showStatus("");
    setBusy(el.formSignup, true, "Creating account…");
    try {
      const user = await auth.signUp({
        displayName: document.getElementById("signup-name").value,
        email: document.getElementById("signup-email").value,
        password: document.getElementById("signup-password").value,
      });
      if (user && user.needsVerification) {
        setBusy(el.formSignup, false);
        setTab("signin");
        document.getElementById("signin-email").value = user.email || "";
        showStatus(
          "Check your email to verify your account, then sign in. The link opens this page.",
          false
        );
        return;
      }
      location.href = next;
    } catch (err) {
      showStatus((err && err.message) || "Could not create account.", true);
      setBusy(el.formSignup, false);
    }
  });

  el.formForgot.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    showStatus("");
    setBusy(el.formForgot, true, "Sending…");
    try {
      await auth.requestPasswordReset({ email: document.getElementById("forgot-email").value });
      showStatus("If an account exists for that email, we sent a link to reset the password.", false);
    } catch (err) {
      showStatus((err && err.message) || "Could not send the reset link.", true);
    }
    setBusy(el.formForgot, false);
  });

  el.formRecovery.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    showStatus("");
    setBusy(el.formRecovery, true, "Saving…");
    try {
      await auth.updatePassword({ password: document.getElementById("recovery-password").value });
      showStatus("Your password is updated.", false);
      renderForUser(auth.getCurrentUser(), { keepStatus: true });
    } catch (err) {
      showStatus((err && err.message) || "Could not update the password.", true);
    }
    setBusy(el.formRecovery, false);
  });

  el.signout.addEventListener("click", async () => {
    await auth.signOut();
    renderForUser(null);
    setTab("signin");
  });

  showStatus("Checking your session…", false);
  auth.onAuthChange((user, meta) => {
    if (busy) return;
    renderForUser(user, meta);
  });
  auth.whenReady().then((user) => {
    if (auth.isPasswordRecovery && auth.isPasswordRecovery()) {
      showRecovery();
      return;
    }
    renderForUser(user);
  });
})();
