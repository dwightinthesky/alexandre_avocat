const consentKey = "aa_cookie_consent";

function setupCookieBanner() {
  const banner = document.getElementById("cookie-banner");
  if (!banner) return;

  const storedConsent = localStorage.getItem(consentKey);
  if (!storedConsent) {
    banner.hidden = false;
  }

  banner.querySelectorAll("[data-cookie-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const choice = button.getAttribute("data-cookie-choice");
      if (choice === "accept" || choice === "reject") {
        localStorage.setItem(consentKey, choice);
      }
      banner.hidden = true;
    });
  });
}

function setupMobileMenu() {
  const toggle = document.querySelector("[data-menu-toggle]");
  const panel = document.getElementById("nav-panel");
  if (!toggle || !panel) return;

  toggle.addEventListener("click", () => {
    const open = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
}

function setupRevealAnimation() {
  const targets = document.querySelectorAll("[data-animate]");
  if (!targets.length) return;

  if (!("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.2,
      rootMargin: "0px 0px -10% 0px"
    }
  );

  targets.forEach((el) => observer.observe(el));
}

window.addEventListener("DOMContentLoaded", () => {
  setupCookieBanner();
  setupMobileMenu();
  setupRevealAnimation();
});
