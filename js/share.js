/**
 * Share a verse card. Uses the Web Share API with the image when the browser
 * allows files, otherwise downloads the image and copies the verse link.
 */
(function (global) {
  "use strict";

  function pageUrl(id) {
    return new URL("/verses/" + id + ".html", global.location.origin).href;
  }

  function imageUrl(id) {
    return new URL("/api/og?id=" + encodeURIComponent(id), global.location.origin).href;
  }

  function toast(message) {
    var el = global.document.getElementById("share-status");
    if (!el) {
      el = global.document.createElement("p");
      el.id = "share-status";
      el.className = "share-status";
      el.setAttribute("role", "status");
      global.document.body.appendChild(el);
    }
    el.textContent = message;
  }

  function download(blob, name) {
    var link = global.document.createElement("a");
    var url = URL.createObjectURL(blob);
    link.href = url;
    link.download = name;
    link.rel = "noopener";
    global.document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  async function copyLink(url) {
    if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
      await global.navigator.clipboard.writeText(url);
      return true;
    }
    return false;
  }

  async function shareVerse(id, reference) {
    var url = pageUrl(id);
    var title = (reference || "His Promise Daily") + " — His Promise Daily";
    var text = reference ? reference + " — His Promise Daily" : "His Promise Daily";
    var file = null;
    try {
      var response = await fetch(imageUrl(id), { credentials: "same-origin" });
      if (response.ok) {
        var blob = await response.blob();
        if (blob && blob.size) {
          file = new File([blob], "his-promise-daily-" + id + ".png", { type: "image/png" });
        }
      }
    } catch (err) {
      file = null;
    }

    var nav = global.navigator;
    if (file && nav.canShare && nav.share) {
      try {
        if (nav.canShare({ files: [file] })) {
          await nav.share({ files: [file], title: title, text: text, url: url });
          return;
        }
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }
    if (nav.share) {
      try {
        await nav.share({ title: title, text: text, url: url });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }

    if (file) download(file, file.name);
    var copied = false;
    try {
      copied = await copyLink(url);
    } catch (err) {
      copied = false;
    }
    if (file && copied) toast("Image downloaded and link copied.");
    else if (copied) toast("Link copied.");
    else if (file) toast("Image downloaded.");
    else toast("Could not share this verse. Copy the page address from the browser.");
  }

  function onClick(event) {
    var button = event.target && event.target.closest ? event.target.closest(".share-btn") : null;
    if (!button) return;
    event.preventDefault();
    var id = button.getAttribute("data-share-id");
    if (!id) return;
    button.disabled = true;
    shareVerse(id, button.getAttribute("data-share-ref") || "").then(function () {
      button.disabled = false;
    }, function () {
      button.disabled = false;
      toast("Could not share this verse.");
    });
  }

  if (global.document && global.document.addEventListener) {
    global.document.addEventListener("click", onClick);
  }

  global.GodsPromisesShare = { shareVerse: shareVerse };
})(typeof window !== "undefined" ? window : globalThis);
