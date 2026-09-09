// ============================================================
//  js/animate.js — universal scroll-reveal + count-up layer
//
//  Imported once from js/ui.js, which every page already loads.
//  Includes bfcache (Back/Forward navigation) restoration support
//  so pages NEVER stay blank when navigating back.
// ============================================================

const REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const REVEAL_SELECTORS = [
  ".card", ".cat-card", ".worker-card", ".stat-card", ".faq-item",
  "table.hs-table tbody tr", ".section-title", ".empty-state", ".hs-bar-track",
].join(",");

let io = null;
function getObserver() {
  if (io) return io;
  io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -20px 0px" });
  return io;
}

function primeCountUp(el) {
  if (el.dataset.countupDone) return;
  const raw = el.textContent.trim();
  const match = raw.match(/([₹]?)(-?[\d,]+(?:\.\d+)?)(.*)$/);
  if (!match) return;
  const [, prefix, numStr, suffix] = match;
  const target = parseFloat(numStr.replace(/,/g, ""));
  if (Number.isNaN(target)) return;
  el.dataset.countupDone = "1";
  if (REDUCED) return;
  el.textContent = prefix + "0" + suffix;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      const duration = 700;
      const start = performance.now();
      function frame(now) {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        const val = target * eased;
        const display = Number.isInteger(target) ? Math.round(val).toLocaleString("en-IN") : val.toFixed(1);
        el.textContent = prefix + display + suffix;
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }, { threshold: 0.2 });
  obs.observe(el);
}

let staggerCounter = 0;
export function scan(root = document) {
  if (REDUCED) {
    root.querySelectorAll(REVEAL_SELECTORS).forEach((el) => el.classList.add("reveal", "in-view"));
    root.querySelectorAll(".stat-value[data-countup], [data-countup]").forEach((el) => el.dataset.countupDone = "1");
    return;
  }
  root.querySelectorAll(REVEAL_SELECTORS).forEach((el) => {
    if (el.classList.contains("in-view")) return;
    el.classList.add("reveal", "in-view");
    el.style.transitionDelay = `${(staggerCounter++ % 6) * 40}ms`;
    getObserver().observe(el);
  });
  root.querySelectorAll(".stat-value, [data-countup]").forEach(primeCountUp);
}

function watchMutations() {
  let pending = false;
  const mo = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; scan(document); }, 100);
  });
  if (document.body) {
    mo.observe(document.body, { childList: true, subtree: true });
  }
}

function restorePageVisibility() {
  document.documentElement.classList.remove("hs-page-exit");
  document.documentElement.classList.remove("hs-page-enter");
  document.documentElement.classList.add("hs-page-enter-active");
  if (document.body) {
    document.body.style.opacity = "1";
    document.body.style.visibility = "visible";
  }
  scan(document);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    restorePageVisibility();
    watchMutations();
  });
} else {
  restorePageVisibility();
  watchMutations();
}

// Ensure pageshow event (fired when navigating back/forward from bfcache) always restores full visibility
window.addEventListener("pageshow", (e) => {
  restorePageVisibility();
});

// Remove any potential lingering exit class
window.addEventListener("popstate", () => {
  restorePageVisibility();
});

