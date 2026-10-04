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

  /** @type {object[]} */
  let items = [];
  let currentIndex = 0;
  /** @type {{ destroy: () => void }|null} */
  let deckBinding = null;

  function redirectLogin() {
    location.href = UI && UI.loginUrl ? UI.loginUrl("me.html") : "login.html?next=me.html";
  }

  function destroyDeckBinding() {
    if (deckBinding && typeof deckBinding.destroy === "function") {
      deckBinding.destroy();
    }
    deckBinding = null;
  }

  function goToIndex(index) {
    const n = items.length;
    if (n === 0) return;
    currentIndex = Math.max(0, Math.min(index, n - 1));
    paintDeck();
  }

  function paintDeck() {
    const n = items.length;
    if (n === 0) return;
    if (currentIndex >= n) currentIndex = n - 1;
    if (currentIndex < 0) currentIndex = 0;

    const p = items[currentIndex];
    let cardHtml = UI.renderPromiseCard(p, { interactiveTags: false });
    cardHtml = cardHtml.replace('class="card', 'class="card card--reading');

    const positionLabel = currentIndex + 1 + " of " + n;
    destroyDeckBinding();
    el.favorites.innerHTML = UI.readingDeckHtml({
      positionLabel,
      cardHtml,
      canPrev: currentIndex > 0,
      canNext: currentIndex < n - 1,
    });
    el.favorites.classList.add("results-host--reading");
    document.body.classList.add("reading-active");

    if (UI.bindReadingDeck) {
      deckBinding = UI.bindReadingDeck(el.favorites, {
        onPrev: function () {
          goToIndex(currentIndex - 1);
        },
        onNext: function () {
          goToIndex(currentIndex + 1);
        },
      });
    }
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
      destroyDeckBinding();
      el.favorites.classList.remove("results-host--reading");
      document.body.classList.remove("reading-active");
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
      destroyDeckBinding();
      el.favorites.classList.remove("results-host--reading");
      document.body.classList.remove("reading-active");
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

  auth.onAuthChange((user) => {
    if (!user) {
      redirectLogin();
      return;
    }
    render();
  });

  render();
})();
