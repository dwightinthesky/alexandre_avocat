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
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
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
      threshold: 0.18,
      rootMargin: "0px 0px -8% 0px"
    }
  );

  targets.forEach((el) => observer.observe(el));
}

function setupScrollProgress() {
  const bar = document.getElementById("scroll-progress");
  if (!bar) return;

  const update = () => {
    const doc = document.documentElement;
    const height = doc.scrollHeight - doc.clientHeight;
    if (height <= 0) {
      bar.style.width = "0";
      return;
    }
    const progress = (doc.scrollTop / height) * 100;
    bar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
}

function setupPointerGlow() {
  const glow = document.getElementById("pointer-glow");
  if (!glow) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  let raf = 0;
  let nextX = 0;
  let nextY = 0;

  const render = () => {
    glow.style.opacity = "1";
    glow.style.left = `${nextX}px`;
    glow.style.top = `${nextY}px`;
    raf = 0;
  };

  window.addEventListener("pointermove", (event) => {
    nextX = event.clientX;
    nextY = event.clientY;
    if (!raf) {
      raf = window.requestAnimationFrame(render);
    }
  });
}

function setupMagneticButtons() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  document.querySelectorAll(".magnetic").forEach((button) => {
    button.addEventListener("mousemove", (event) => {
      const rect = button.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      button.style.setProperty("--btn-x", `${x * 0.1}px`);
      button.style.setProperty("--btn-y", `${y * 0.1}px`);
    });

    button.addEventListener("mouseleave", () => {
      button.style.setProperty("--btn-x", "0px");
      button.style.setProperty("--btn-y", "0px");
    });
  });
}

function setupTiltCards() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  document.querySelectorAll(".tilt-card").forEach((card) => {
    card.addEventListener("mousemove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const rotateY = (x - 0.5) * 7;
      const rotateX = (0.5 - y) * 7;
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
    });
  });
}

function setupAccordion() {
  document.querySelectorAll("[data-accordion-trigger]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const panelId = trigger.getAttribute("aria-controls");
      if (!panelId) return;

      const panel = document.getElementById(panelId);
      if (!panel) return;

      const expanded = trigger.getAttribute("aria-expanded") === "true";
      trigger.setAttribute("aria-expanded", String(!expanded));
      panel.classList.toggle("panel-hidden", expanded);
    });
  });
}

function setupScrambleText() {
  const nodes = document.querySelectorAll("[data-scramble]");
  if (!nodes.length) return;

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  nodes.forEach((node) => {
    const finalText = node.getAttribute("data-scramble");
    if (!finalText) return;

    let frame = 0;
    const total = finalText.length * 2;

    const tick = () => {
      let out = "";
      for (let i = 0; i < finalText.length; i += 1) {
        if (i < frame / 2) {
          out += finalText[i];
        } else if (finalText[i] === " ") {
          out += " ";
        } else {
          out += letters[Math.floor(Math.random() * letters.length)];
        }
      }
      node.textContent = out;
      frame += 1;
      if (frame <= total) {
        window.requestAnimationFrame(tick);
      } else {
        node.textContent = finalText;
      }
    };

    tick();
  });
}

window.addEventListener("DOMContentLoaded", () => {
  setupCookieBanner();
  setupMobileMenu();
  setupRevealAnimation();
  setupScrollProgress();
  setupPointerGlow();
  setupMagneticButtons();
  setupTiltCards();
  setupAccordion();
  setupScrambleText();
});
