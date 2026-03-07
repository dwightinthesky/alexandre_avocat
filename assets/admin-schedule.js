(function () {
  const app = document.querySelector("[data-admin-app]");
  if (!app) return;

  const loginPanel = app.querySelector("[data-admin-login-panel]");
  const editorPanel = app.querySelector("[data-admin-editor-panel]");
  const loginForm = app.querySelector("[data-admin-login-form]");
  const loginStatus = app.querySelector("[data-admin-login-status]");
  const dateList = app.querySelector("[data-admin-date-list]");
  const slotGrid = app.querySelector("[data-admin-slot-grid]");
  const dateTitle = app.querySelector("[data-admin-date-title]");
  const editorStatus = app.querySelector("[data-admin-editor-status]");
  const saveButton = app.querySelector("[data-admin-save]");
  const logoutButton = app.querySelector("[data-admin-logout]");

  if (
    !loginPanel ||
    !editorPanel ||
    !loginForm ||
    !loginStatus ||
    !dateList ||
    !slotGrid ||
    !dateTitle ||
    !editorStatus ||
    !saveButton ||
    !logoutButton
  ) {
    return;
  }

  const SLOT_OPTIONS = (() => {
    const values = [];
    for (let hour = 8; hour <= 20; hour += 1) {
      values.push(`${String(hour).padStart(2, "0")}:00`);
      if (hour < 20) values.push(`${String(hour).padStart(2, "0")}:30`);
    }
    return values;
  })();

  const DAY_COUNT = 90;
  const state = {
    days: {},
    selectedDate: "",
    dirty: false,
    saving: false
  };

  function toISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function isWeekday(date) {
    const day = date.getDay();
    return day !== 0 && day !== 6;
  }

  function sortSlots(slots) {
    return [...slots].sort((a, b) => a.localeCompare(b));
  }

  function normalizeSlots(slots) {
    if (!Array.isArray(slots)) return [];
    const unique = new Set();
    slots.forEach((slot) => {
      const value = String(slot || "").trim();
      if (/^([01]\d|2[0-3]):[03]0$/.test(value)) unique.add(value);
    });
    return sortSlots(Array.from(unique));
  }

  function nextBusinessDates(limit) {
    const list = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    for (let offset = 0; list.length < limit && offset < 180; offset += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + offset);
      if (!isWeekday(date)) continue;
      list.push(toISODate(date));
    }

    return list;
  }

  function ensureDateRange(days) {
    const merged = { ...days };
    nextBusinessDates(DAY_COUNT).forEach((dayKey) => {
      if (!Array.isArray(merged[dayKey])) {
        merged[dayKey] = [];
      }
      merged[dayKey] = normalizeSlots(merged[dayKey]);
    });
    return merged;
  }

  function setLoginStatus(message, tone = "") {
    loginStatus.textContent = message;
    loginStatus.classList.toggle("is-error", tone === "error");
    loginStatus.classList.toggle("is-success", tone === "success");
  }

  function setEditorStatus(message, tone = "") {
    editorStatus.textContent = message;
    editorStatus.classList.toggle("is-error", tone === "error");
    editorStatus.classList.toggle("is-success", tone === "success");
  }

  function updateSaveState() {
    saveButton.disabled = !state.dirty || state.saving;
  }

  function markDirty(nextDirty) {
    state.dirty = nextDirty;
    updateSaveState();
  }

  function formatDateLabel(isoDate) {
    const value = new Date(`${isoDate}T00:00:00`);
    return value.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "short"
    });
  }

  function selectDate(dateKey) {
    state.selectedDate = dateKey;
    renderDateList();
    renderSlotGrid();
  }

  function toggleSlot(slot) {
    if (!state.selectedDate) return;

    const currentSlots = normalizeSlots(state.days[state.selectedDate] || []);
    const next = currentSlots.includes(slot)
      ? currentSlots.filter((entry) => entry !== slot)
      : sortSlots([...currentSlots, slot]);

    state.days[state.selectedDate] = next;
    markDirty(true);
    renderSlotGrid();
    setEditorStatus("Modifications locales non enregistrées.");
  }

  function renderDateList() {
    dateList.innerHTML = "";

    const dateKeys = nextBusinessDates(DAY_COUNT);
    if (!state.selectedDate && dateKeys.length) {
      state.selectedDate = dateKeys[0];
    }

    const fragment = document.createDocumentFragment();
    dateKeys.forEach((dateKey) => {
      const button = document.createElement("button");
      const slotCount = normalizeSlots(state.days[dateKey] || []).length;
      button.type = "button";
      button.className = `admin-date-btn${state.selectedDate === dateKey ? " is-active" : ""}`;
      button.innerHTML = `
        <span>${formatDateLabel(dateKey)}</span>
        <small>${slotCount} créneau${slotCount > 1 ? "x" : ""}</small>
      `;
      button.addEventListener("click", () => {
        selectDate(dateKey);
      });
      fragment.appendChild(button);
    });

    dateList.appendChild(fragment);
  }

  function renderSlotGrid() {
    slotGrid.innerHTML = "";

    if (!state.selectedDate) {
      dateTitle.textContent = "Sélectionnez une date";
      return;
    }

    dateTitle.textContent = `Disponibilités: ${new Date(`${state.selectedDate}T00:00:00`).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    })}`;

    const active = new Set(normalizeSlots(state.days[state.selectedDate] || []));
    const fragment = document.createDocumentFragment();

    SLOT_OPTIONS.forEach((slot) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `admin-slot-btn${active.has(slot) ? " is-active" : ""}`;
      button.textContent = slot;
      button.addEventListener("click", () => toggleSlot(slot));
      fragment.appendChild(button);
    });

    slotGrid.appendChild(fragment);
  }

  function showLoginPanel() {
    loginPanel.classList.remove("is-hidden");
    editorPanel.classList.add("is-hidden");
  }

  function showEditorPanel() {
    loginPanel.classList.add("is-hidden");
    editorPanel.classList.remove("is-hidden");
  }

  async function fetchSession() {
    const response = await fetch("/api/admin/session", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) return { authenticated: false, configured: false };
    return response.json();
  }

  async function fetchSchedule() {
    const response = await fetch("/api/schedule", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("schedule_fetch_failed");
    }

    const payload = await response.json();
    const days = payload && payload.days && typeof payload.days === "object" ? payload.days : {};
    state.days = ensureDateRange(days);

    if (!state.selectedDate || !state.days[state.selectedDate]) {
      state.selectedDate = nextBusinessDates(DAY_COUNT)[0] || "";
    }

    markDirty(false);
    renderDateList();
    renderSlotGrid();
  }

  async function saveSchedule() {
    state.saving = true;
    updateSaveState();
    setEditorStatus("Enregistrement en cours...");

    try {
      const response = await fetch("/api/schedule", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ days: state.days })
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("unauthorized");
        }
        throw new Error("save_failed");
      }

      const payload = await response.json();
      const nextDays = payload && payload.days && typeof payload.days === "object" ? payload.days : {};
      state.days = ensureDateRange(nextDays);
      markDirty(false);
      renderDateList();
      renderSlotGrid();
      setEditorStatus("Planning enregistré.", "success");
    } catch (error) {
      if (error.message === "unauthorized") {
        showLoginPanel();
        setLoginStatus("Session expirée. Reconnectez-vous.", "error");
      } else {
        setEditorStatus("Échec de l'enregistrement. Réessayez.", "error");
      }
    } finally {
      state.saving = false;
      updateSaveState();
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const usernameField = loginForm.querySelector("[name='username']");
    const passwordField = loginForm.querySelector("[name='password']");
    const username = usernameField ? usernameField.value.trim() : "";
    const password = passwordField ? passwordField.value : "";

    if (!username || !password) {
      setLoginStatus("Identifiants requis.", "error");
      return;
    }

    setLoginStatus("Connexion...");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        if (response.status === 500) {
          setLoginStatus("Configuration serveur incomplète (variables d'environnement).", "error");
          return;
        }
        setLoginStatus("Identifiants invalides.", "error");
        return;
      }

      setLoginStatus("Connexion réussie.", "success");
      showEditorPanel();
      await fetchSchedule();
      setEditorStatus("Planning chargé.", "success");
      loginForm.reset();
    } catch (error) {
      setLoginStatus("Erreur réseau. Réessayez.", "error");
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        headers: { Accept: "application/json" }
      });
    } catch (error) {
      // Ignore network errors on logout and force panel switch.
    }

    showLoginPanel();
    setLoginStatus("Déconnecté.", "success");
    setEditorStatus("");
  });

  saveButton.addEventListener("click", async () => {
    if (!state.dirty || state.saving) return;
    await saveSchedule();
  });

  (async () => {
    const session = await fetchSession();

    if (!session.configured) {
      showLoginPanel();
      setLoginStatus("Config backend manquante: SCHEDULE_ADMIN_USERNAME, SCHEDULE_ADMIN_PASSWORD, SCHEDULE_AUTH_SECRET.", "error");
      return;
    }

    if (!session.authenticated) {
      showLoginPanel();
      setLoginStatus("Accès restreint. Connectez-vous.");
      return;
    }

    showEditorPanel();
    await fetchSchedule();
    setEditorStatus("Planning chargé.", "success");
  })();
})();
