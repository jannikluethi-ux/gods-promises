(function () {
  "use strict";

  const auth = window.GodsPromisesAuth;
  const favs = window.GodsPromisesFavorites;
  const sub = window.GodsPromisesSubscription;
  const UI = window.GodsPromisesUI;
  const Versions = window.GodsPromisesVersions;
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
    version: document.getElementById("version-filter"),
  };

  const byId = new Map();
  if (data && Array.isArray(data.promises)) {
    for (const p of data.promises) byId.set(p.id, p);
  }

  /** @type {object[]} */
  let items = [];
  let currentIndex = 0;
  /** Shared reading deck (same controller as the home page); bound once. */
  const deck =
    UI && UI.createReadingDeck ? UI.createReadingDeck(el.favorites) : null;

  function redirectLogin() {
    location.href = UI && UI.loginUrl ? UI.loginUrl("me.html") : "login.html?next=me.html";
  }

  function clearDeck(html) {
    if (deck) deck.reset();
    el.favorites.classList.remove("results-host--reading");
    document.body.classList.remove("reading-active");
    el.favorites.innerHTML = html;
  }

  function paintDeck() {
    const n = items.length;
    if (n === 0) return;
    if (currentIndex >= n) currentIndex = n - 1;
    if (currentIndex < 0) currentIndex = 0;
    const list = items;
    document.body.classList.add("reading-active");
    deck.show({
      key: "favorites",
      count: n,
      index: currentIndex,
      renderCard: (i) => UI.renderPromiseCard(list[i], { interactiveTags: false }),
      afterPaint: (li, i) => {
        if (Versions && Versions.hydrateCards) Versions.hydrateCards(el.favorites, [list[i]]);
      },
      onIndexChange: (i) => {
        currentIndex = i;
      },
      labels: {
        prev: "Previous",
        next: "Next",
        prevAria: "Previous favorite",
        nextAria: "Next favorite",
        viewport: "Your favorite promises",
      },
      hint: (i, total) => (total > 1 ? "Swipe or use the arrows" : ""),
    });
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
      clearDeck("");
      el.upgrade.hidden = false;
      el.toolbar.hidden = true;
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
    const previousId =
      items[currentIndex] && items[currentIndex].id
        ? items[currentIndex].id
        : null;
    items = ids.map((id) => byId.get(id)).filter(Boolean);
    // Preserve saved order (list() order)
    const n = items.length;
    el.count.innerHTML =
      n === 0
        ? "<strong>No favorites yet</strong>"
        : `<strong>${n}</strong> favorite${n === 1 ? "" : "s"}`;

    if (n === 0) {
      clearDeck(`
        <div class="empty" role="status">
          <h2>No favorites yet</h2>
          <p>
            Search the catalog and tap the <strong>cross</strong> on any promise to save it here.
          </p>
          <p class="empty-cta"><a class="btn-primary" href="index.html">Find promises</a></p>
        </div>`);
      return;
    }

    if (previousId) {
      const keep = items.findIndex((p) => p.id === previousId);
      currentIndex = keep >= 0 ? keep : Math.min(currentIndex, n - 1);
    } else {
      currentIndex = Math.min(currentIndex, n - 1);
    }

    paintDeck();
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

  if (Versions && Versions.fillSelect && el.version) {
    Versions.fillSelect(el.version);
    el.version.addEventListener("change", function () {
      Versions.setCurrent(el.version.value);
      // Same card, new translation — position is kept.
      if (items.length && deck) deck.refresh();
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
