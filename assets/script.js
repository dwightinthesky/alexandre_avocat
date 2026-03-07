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
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll("[data-accordion-trigger]").forEach((trigger) => {
    const panelId = trigger.getAttribute("aria-controls");
    if (!panelId) return;

    const panel = document.getElementById(panelId);
    if (!panel) return;

    const syncPanelState = () => {
      const expanded = trigger.getAttribute("aria-expanded") === "true";
      panel.classList.remove("panel-hidden");
      panel.classList.toggle("is-open", expanded);
      panel.style.maxHeight = expanded ? `${panel.scrollHeight}px` : "0px";
    };

    syncPanelState();

    trigger.addEventListener("click", () => {
      const expanded = trigger.getAttribute("aria-expanded") === "true";
      const nextExpanded = !expanded;
      trigger.setAttribute("aria-expanded", String(nextExpanded));
      panel.classList.remove("panel-hidden");
      panel.classList.toggle("is-open", nextExpanded);

      if (nextExpanded) {
        panel.style.maxHeight = `${panel.scrollHeight}px`;
        return;
      }

      panel.style.maxHeight = `${panel.scrollHeight}px`;
      if (reduced) {
        panel.style.maxHeight = "0px";
      } else {
        requestAnimationFrame(() => {
          panel.style.maxHeight = "0px";
        });
      }
    });

    window.addEventListener("resize", () => {
      if (trigger.getAttribute("aria-expanded") === "true") {
        panel.style.maxHeight = `${panel.scrollHeight}px`;
      }
    });
  });
}

function setupScrambleText() {
  const nodes = document.querySelectorAll("[data-scramble]");
  if (!nodes.length) return;

  nodes.forEach((node) => {
    const finalText = node.getAttribute("data-scramble");
    if (!finalText) return;
    node.textContent = finalText;
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
      const offset = y * factor * 0.35;
      node.style.transform = `translateY(${offset}px)`;
    });
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function formatICSDateLocal(date) {
  return `${date.getFullYear()}${padNumber(date.getMonth() + 1)}${padNumber(date.getDate())}T${padNumber(
    date.getHours()
  )}${padNumber(date.getMinutes())}00`;
}

function formatGoogleUTC(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeICS(text) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function buildICSFile({ uid, start, end, title, description, location }) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Alexandre Avocat//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatGoogleUTC(new Date())}`,
    `DTSTART:${formatICSDateLocal(start)}`,
    `DTEND:${formatICSDateLocal(end)}`,
    `SUMMARY:${escapeICS(title)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `LOCATION:${escapeICS(location)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

function setupBookingWidgets() {
  const widgets = document.querySelectorAll("[data-booking-widget]");
  if (!widgets.length) return;

  widgets.forEach((widget) => {
    const form = widget.querySelector("form");
    const dateInput = widget.querySelector("[name='appointment_date']");
    const timeInput = widget.querySelector("[name='appointment_time']");
    const modeInput = widget.querySelector("[name='appointment_mode']");
    const nameInput = widget.querySelector("[name='appointment_name']");
    const emailInput = widget.querySelector("[name='appointment_email']");
    const messageInput = widget.querySelector("[name='appointment_message']");
    const result = widget.querySelector("[data-booking-result]");
    const summary = widget.querySelector("[data-booking-summary]");
    const googleLink = widget.querySelector("[data-link-google]");
    const outlookLink = widget.querySelector("[data-link-outlook]");
    const appleLink = widget.querySelector("[data-link-apple]");
    const icsLink = widget.querySelector("[data-link-ics]");
    const selectedTimeLabel = widget.querySelector("[data-selected-time]");
    const previewDate = widget.querySelector("[data-preview-date]");
    const previewTime = widget.querySelector("[data-preview-time]");
    const previewMode = widget.querySelector("[data-preview-mode]");
    const resultName = widget.querySelector("[data-result-name]");
    const resultDate = widget.querySelector("[data-result-date]");
    const resultTime = widget.querySelector("[data-result-time]");
    const resultMode = widget.querySelector("[data-result-mode]");
    const slotButtons = Array.from(widget.querySelectorAll("[data-slot-value]"));
    const lang = widget.getAttribute("data-lang") === "en" ? "en" : "fr";
    const locale = lang === "fr" ? "fr-FR" : "en-GB";

    if (
      !form ||
      !dateInput ||
      !timeInput ||
      !modeInput ||
      !nameInput ||
      !emailInput ||
      !result ||
      !summary ||
      !googleLink ||
      !outlookLink ||
      !appleLink ||
      !icsLink
    ) {
      return;
    }

    const today = new Date();
    const minDate = `${today.getFullYear()}-${padNumber(today.getMonth() + 1)}-${padNumber(today.getDate())}`;
    dateInput.setAttribute("min", minDate);

    let icsUrl = "";
    const emptyDateText = lang === "fr" ? "À sélectionner" : "To be selected";
    const emptyTimeText = lang === "fr" ? "À sélectionner" : "To be selected";
    const emptyModeText = lang === "fr" ? "À sélectionner" : "To be selected";
    const emptySlotText = lang === "fr" ? "Aucun horaire sélectionné." : "No time selected yet.";
    const formatMap =
      lang === "fr"
        ? { online: "En ligne (visioconférence)", cabinet: "En cabinet" }
        : { online: "Online (video consultation)", cabinet: "In-office" };

    const updatePreview = () => {
      if (previewDate) {
        if (!dateInput.value) {
          previewDate.textContent = emptyDateText;
        } else {
          const previewDateValue = new Date(`${dateInput.value}T00:00:00`);
          previewDate.textContent = previewDateValue.toLocaleDateString(locale, {
            day: "2-digit",
            month: "long",
            year: "numeric"
          });
        }
      }

      if (previewTime) {
        previewTime.textContent = timeInput.value || emptyTimeText;
      }

      if (previewMode) {
        const modeValue = modeInput.value;
        previewMode.textContent = formatMap[modeValue] || emptyModeText;
      }
    };

    const setSlot = (value) => {
      timeInput.value = value;
      slotButtons.forEach((button) => {
        button.classList.toggle("is-selected", button.getAttribute("data-slot-value") === value);
      });
      if (selectedTimeLabel) {
        selectedTimeLabel.textContent =
          lang === "fr" ? `Horaire sélectionné: ${value}` : `Selected time: ${value}`;
      }
      updatePreview();
    };

    if (slotButtons.length) {
      slotButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const value = button.getAttribute("data-slot-value");
          if (!value) return;
          setSlot(value);
        });
      });
    }

    dateInput.addEventListener("change", updatePreview);
    dateInput.addEventListener("input", updatePreview);
    modeInput.addEventListener("change", updatePreview);
    modeInput.addEventListener("input", updatePreview);

    if (selectedTimeLabel) {
      selectedTimeLabel.textContent = emptySlotText;
    }
    updatePreview();

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const dateValue = dateInput.value;
      const timeValue = timeInput.value;
      const modeValue = modeInput.value;
      const nameValue = nameInput.value.trim();
      const emailValue = emailInput.value.trim();
      const messageValue = messageInput ? messageInput.value.trim() : "";

      if (!dateValue || !timeValue || !modeValue || !nameValue || !emailValue) return;

      const start = new Date(`${dateValue}T${timeValue}:00`);
      if (Number.isNaN(start.getTime())) return;
      const end = new Date(start.getTime() + 60 * 60 * 1000);

      const modeLabel = formatMap[modeValue] || (lang === "fr" ? "En cabinet" : "In-office");
      const isOnline = modeValue === "online";
      const location = isOnline
        ? lang === "fr"
          ? "Consultation en visioconférence (lien envoyé après confirmation)"
          : "Online consultation (link shared after confirmation)"
        : "Cabinet Alexandre Avocat, Paris";
      const title = isOnline
        ? lang === "fr"
          ? "Consultation en ligne - Alexandre Avocat"
          : "Online consultation - Alexandre Avocat"
        : lang === "fr"
          ? "Rendez-vous en cabinet - Alexandre Avocat"
          : "In-office meeting - Alexandre Avocat";
      const details = [
        lang === "fr" ? "Réservation effectuée via le site." : "Booking submitted from website.",
        `${lang === "fr" ? "Nom" : "Name"}: ${nameValue}`,
        `Email: ${emailValue}`,
        `${lang === "fr" ? "Format" : "Format"}: ${modeLabel}`,
        messageValue ? `${lang === "fr" ? "Message" : "Message"}: ${messageValue}` : ""
      ]
        .filter(Boolean)
        .join("\n");

      const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@alexandre-avocat`;
      const icsData = buildICSFile({
        uid,
        start,
        end,
        title,
        description: details,
        location
      });

      if (icsUrl) URL.revokeObjectURL(icsUrl);
      icsUrl = URL.createObjectURL(new Blob([icsData], { type: "text/calendar;charset=utf-8" }));

      const googleUrl = new URL("https://calendar.google.com/calendar/render");
      googleUrl.searchParams.set("action", "TEMPLATE");
      googleUrl.searchParams.set("text", title);
      googleUrl.searchParams.set("dates", `${formatGoogleUTC(start)}/${formatGoogleUTC(end)}`);
      googleUrl.searchParams.set("details", details);
      googleUrl.searchParams.set("location", location);

      const outlookUrl = new URL("https://outlook.live.com/calendar/0/deeplink/compose");
      outlookUrl.searchParams.set("path", "/calendar/action/compose");
      outlookUrl.searchParams.set("rru", "addevent");
      outlookUrl.searchParams.set("subject", title);
      outlookUrl.searchParams.set("startdt", start.toISOString());
      outlookUrl.searchParams.set("enddt", end.toISOString());
      outlookUrl.searchParams.set("body", details);
      outlookUrl.searchParams.set("location", location);

      googleLink.href = googleUrl.toString();
      outlookLink.href = outlookUrl.toString();
      appleLink.href = icsUrl;
      icsLink.href = icsUrl;

      const fileName = lang === "fr" ? "rendez-vous.ics" : "appointment.ics";
      appleLink.setAttribute("download", fileName);
      icsLink.setAttribute("download", fileName);

      const summaryText =
        lang === "fr"
          ? `Rendez-vous confirmé le ${start.toLocaleDateString(locale)} à ${start.toLocaleTimeString(locale, {
              hour: "2-digit",
              minute: "2-digit"
            })} (${modeLabel}).`
          : `Appointment confirmed on ${start.toLocaleDateString(locale)} at ${start.toLocaleTimeString(locale, {
              hour: "2-digit",
              minute: "2-digit"
            })} (${modeLabel}).`;
      summary.textContent = summaryText;
      if (resultName) resultName.textContent = nameValue;
      if (resultDate) {
        resultDate.textContent = start.toLocaleDateString(locale, {
          day: "2-digit",
          month: "long",
          year: "numeric"
        });
      }
      if (resultTime) {
        resultTime.textContent = start.toLocaleTimeString(locale, {
          hour: "2-digit",
          minute: "2-digit"
        });
      }
      if (resultMode) {
        resultMode.textContent = modeLabel;
      }
      result.classList.remove("is-hidden");
      result.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    window.addEventListener("beforeunload", () => {
      if (icsUrl) URL.revokeObjectURL(icsUrl);
    });
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
  setupMetricCounters();
  setupValueSwitcher();
  setupQuickRail();
  setupParallax();
  setupBookingWidgets();
});
