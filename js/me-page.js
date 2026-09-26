(function () {
  "use strict";

  const auth = window.GodsPromisesAuth;
  const favs = window.GodsPromisesFavorites;
  const sub = window.GodsPromisesSubscription;
  const UI = window.GodsPromisesUI;
  const data = window.GODS_PROMISES_DATA;

  if (UI && UI.initAuthNav) UI.initAuthNav();

  const el = {
    title: document.getElementById("me-title"),
    lede: document.getElementById("me-lede"),
    favorites: document.getElementById("favorites"),
    toolbar: document.getElementById("me-toolbar"),
    count: document.getElementById("fav-count"),
    upgrade: document.getElementById("upgrade-panel"),
    signout: document.getElementById("signout-btn"),
  };

  const byId = new Map();
  if (data && Array.isArray(data.promises)) {
    for (const p of data.promises) byId.set(p.id, p);
  }

  function redirectLogin() {
    location.href = UI && UI.loginUrl ? UI.loginUrl("me.html") : "login.html?next=me.html";
  }

  function render() {
    const user = auth.getCurrentUser();
    if (!user) {
      redirectLogin();
      return;
    }

    const canApp = !sub || sub.canAccessApp(user);
    const canFav = !sub || sub.canAccessFavorites(user);

    if (!canApp || !canFav) {
      el.upgrade.hidden = false;
      el.toolbar.hidden = true;
      el.favorites.innerHTML = "";
      el.title.textContent = "My favorites";
      el.lede.textContent = "A subscription will unlock your personal favorites.";
      if (location.hash === "#upgrade") {
        el.upgrade.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    el.upgrade.hidden = true;
    el.toolbar.hidden = false;

    const name = user.displayName || user.email;
    el.title.textContent = `Welcome, ${name}`;
    el.lede.textContent = "Promises you’ve marked with the cross. Tap the cross again to remove.";

    const ids = favs.list();
    const items = ids.map((id) => byId.get(id)).filter(Boolean);
    // Preserve saved order (list() order)
    const n = items.length;
    el.count.innerHTML =
      n === 0
        ? "<strong>No favorites yet</strong>"
        : `<strong>${n}</strong> favorite${n === 1 ? "" : "s"}`;

    if (n === 0) {
      el.favorites.innerHTML = `
        <div class="empty" role="status">
          <h2>No favorites yet</h2>
          <p>
            Search the catalog and tap the <strong>cross</strong> on any promise to save it here.
          </p>
          <p class="empty-cta"><a class="btn-primary" href="index.html">Find promises</a></p>
        </div>`;
      return;
    }

    el.favorites.innerHTML = `<ul class="results">${items
      .map((p) => UI.renderPromiseCard(p, { interactiveTags: false }))
      .join("")}</ul>`;
  }

  el.signout.addEventListener("click", async () => {
    await auth.signOut();
    redirectLogin();
  });

  if (UI && UI.bindFavoriteClicks) {
    UI.bindFavoriteClicks(el.favorites, {
      onChange() {
        render();
      },
    });
  }

  auth.onAuthChange((user) => {
    if (!user) {
      redirectLogin();
      return;
    }
    render();
  });

  render();
})();
