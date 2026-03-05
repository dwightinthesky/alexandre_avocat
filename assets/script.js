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

function setupMetricCounters() {
  const counters = document.querySelectorAll("[data-count]");
  if (!counters.length) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const observed = new WeakSet();

  const animate = (node) => {
    if (observed.has(node)) return;
    observed.add(node);

    const target = Number(node.getAttribute("data-count"));
    if (!Number.isFinite(target)) return;

    const suffix = node.getAttribute("data-suffix") ?? "";
    const duration = reduced ? 0 : 900;
    const startedAt = performance.now();

    const tick = (now) => {
      const elapsed = now - startedAt;
      const progress = duration === 0 ? 1 : Math.min(1, elapsed / duration);
      const eased = 1 - (1 - progress) ** 3;
      const value = Math.round(target * eased);
      node.textContent = `${value}${suffix}`;
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  };

  if (!("IntersectionObserver" in window) || reduced) {
    counters.forEach(animate);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.45 }
  );

  counters.forEach((counter) => observer.observe(counter));
}

function setupValueSwitcher() {
  const root = document.querySelector("[data-switcher]");
  if (!root) return;

  const buttons = root.querySelectorAll("[data-switch-button]");
  const panels = root.querySelectorAll("[data-switch-panel]");

  const select = (targetId) => {
    buttons.forEach((button) => {
      const active = button.getAttribute("data-target") === targetId;
      button.setAttribute("aria-selected", String(active));
      button.classList.toggle("is-active", active);
      button.tabIndex = active ? 0 : -1;
    });

    panels.forEach((panel) => {
      const active = panel.id === targetId;
      panel.classList.toggle("panel-hidden", !active);
    });
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-target");
      if (targetId) select(targetId);
    });
  });
}

function setupQuickRail() {
  const links = document.querySelectorAll("[data-quick-link]");
  if (!links.length) return;

  const activate = (id) => {
    links.forEach((link) => {
      const active = link.getAttribute("href") === `#${id}`;
      link.classList.toggle("is-active", active);
      link.setAttribute("aria-current", active ? "true" : "false");
    });
  };

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || !href.startsWith("#")) return;
      const target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  if (!("IntersectionObserver" in window)) return;

  const sections = Array.from(links)
    .map((link) => {
      const href = link.getAttribute("href");
      return href ? document.querySelector(href) : null;
    })
    .filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) {
        activate(visible.target.id);
      }
    },
    { threshold: [0.2, 0.45, 0.7], rootMargin: "-10% 0px -40% 0px" }
  );

  sections.forEach((section) => observer.observe(section));
}

function setupParallax() {
  const nodes = document.querySelectorAll("[data-parallax]");
  if (!nodes.length) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  const update = () => {
    const y = window.scrollY;
    nodes.forEach((node) => {
      const factor = Number(node.getAttribute("data-parallax") ?? "0");
      const offset = y * factor;
      node.style.transform = `translateY(${offset}px)`;
    });
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
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
  setupMetricCounters();
  setupValueSwitcher();
  setupQuickRail();
  setupParallax();
});
