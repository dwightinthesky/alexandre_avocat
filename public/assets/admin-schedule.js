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
  const syncForm = app.querySelector("[data-admin-sync-form]");
  const icsInput = app.querySelector("[data-admin-ics-url]");
  const syncStatus = app.querySelector("[data-admin-sync-status]");
  const ruleList = app.querySelector("[data-admin-rule-list]");
  const rulesStatus = app.querySelector("[data-admin-rules-status]");
  const ruleDaysWrap = app.querySelector("[data-admin-rule-days]");
  const ruleStartSelect = app.querySelector("[data-admin-rule-start]");
  const ruleEndSelect = app.querySelector("[data-admin-rule-end]");
  const ruleTypeSelect = app.querySelector("[data-admin-rule-type]");
  const ruleAddButton = app.querySelector("[data-admin-rule-add]");
  const rulesApplyButton = app.querySelector("[data-admin-rules-apply]");

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
    !logoutButton ||
    !syncForm ||
    !icsInput ||
    !syncStatus ||
    !ruleList ||
    !rulesStatus ||
    !ruleDaysWrap ||
    !ruleStartSelect ||
    !ruleEndSelect ||
    !ruleTypeSelect ||
    !ruleAddButton ||
    !rulesApplyButton
  ) {
    return;
  }

  const RULE_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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
    rules: [],
    outlookIcsUrl: "",
    selectedDate: "",
    dirty: false,
    saving: false,
    syncing: false,
    applyingRules: false,
    newRule: {
      days: [],
      startTime: "08:00",
      endTime: "20:00",
      type: "unavailable"
    }
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

  function normalizeRules(rules) {
    if (!Array.isArray(rules)) return [];

    const valid = [];
    const seen = new Set();

    rules.forEach((rule) => {
      const safe = rule && typeof rule === "object" ? rule : {};
      const idBase = String(safe.id || "").trim() || `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const id = seen.has(idBase) ? `${idBase}_${Math.random().toString(36).slice(2, 5)}` : idBase;
      seen.add(id);

      const days = Array.isArray(safe.days)
        ? Array.from(new Set(safe.days.map((entry) => String(entry || "").trim()).filter((entry) => RULE_DAYS.includes(entry))))
        : [];
      const startTime = String(safe.startTime || "").trim();
      const endTime = String(safe.endTime || "").trim();
      const type = safe.type === "available" ? "available" : "unavailable";

      if (!days.length) return;
      if (!/^([01]\d|2[0-3]):[03]0$/.test(startTime)) return;
      if (!/^([01]\d|2[0-3]):[03]0$/.test(endTime)) return;
      if (!(startTime < endTime)) return;

      valid.push({ id, days, startTime, endTime, type });
    });

    return valid;
  }

  function nextBusinessDates(limit) {
    const list = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    for (let offset = 0; list.length < limit && offset < 220; offset += 1) {
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

  function setStatus(node, message, tone = "") {
    node.textContent = message;
    node.classList.toggle("is-error", tone === "error");
    node.classList.toggle("is-success", tone === "success");
  }

  function setLoginStatus(message, tone = "") {
    setStatus(loginStatus, message, tone);
  }

  function setEditorStatus(message, tone = "") {
    setStatus(editorStatus, message, tone);
  }

  function setSyncStatus(message, tone = "") {
    setStatus(syncStatus, message, tone);
  }

  function setRulesStatus(message, tone = "") {
    setStatus(rulesStatus, message, tone);
  }

  function updateSaveState() {
    saveButton.disabled = !state.dirty || state.saving || state.syncing || state.applyingRules;
    rulesApplyButton.disabled = state.syncing || state.applyingRules || state.saving;
    ruleAddButton.disabled = state.syncing || state.applyingRules || state.saving;
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
    renderDateList();
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

  function renderRuleDayChips() {
    const selected = new Set(state.newRule.days);
    ruleDaysWrap.querySelectorAll("[data-rule-day]").forEach((button) => {
      const day = button.getAttribute("data-rule-day") || "";
      button.classList.toggle("is-active", selected.has(day));
    });
  }

  function describeRule(rule) {
    const days = rule.days.join(", ");
    const kind = rule.type === "available" ? "Disponible" : "Indisponible";
    return `${days} · ${rule.startTime} - ${rule.endTime} · ${kind}`;
  }

  function renderRules() {
    ruleList.innerHTML = "";
    if (!state.rules.length) {
      const empty = document.createElement("p");
      empty.className = "note";
      empty.textContent = "Aucune règle active.";
      ruleList.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    state.rules.forEach((rule) => {
      const row = document.createElement("div");
      row.className = "admin-rule-item";

      const text = document.createElement("p");
      text.className = "note";
      text.textContent = describeRule(rule);
      row.appendChild(text);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn btn-ghost admin-rule-remove";
      remove.textContent = "Supprimer";
      remove.addEventListener("click", () => {
        state.rules = state.rules.filter((entry) => entry.id !== rule.id);
        markDirty(true);
        renderRules();
        setRulesStatus("Règle supprimée. Pensez à enregistrer.");
      });
      row.appendChild(remove);
      fragment.appendChild(row);
    });

    ruleList.appendChild(fragment);
  }

  function populateTimeOptions() {
    const populate = (select, selectedValue) => {
      select.innerHTML = "";
      SLOT_OPTIONS.forEach((slot) => {
        const option = document.createElement("option");
        option.value = slot;
        option.textContent = slot;
        if (slot === selectedValue) option.selected = true;
        select.appendChild(option);
      });
    };

    populate(ruleStartSelect, state.newRule.startTime);
    populate(ruleEndSelect, state.newRule.endTime);
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
    const response = await fetch("/api/admin/schedule", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(response.status === 401 ? "unauthorized" : "schedule_fetch_failed");
    }

    const payload = await response.json();
    state.days = ensureDateRange(payload && payload.days && typeof payload.days === "object" ? payload.days : {});
    state.rules = normalizeRules(payload && Array.isArray(payload.rules) ? payload.rules : []);
    state.outlookIcsUrl = String(payload && payload.outlookIcsUrl ? payload.outlookIcsUrl : "").trim();
    icsInput.value = state.outlookIcsUrl;

    if (!state.selectedDate || !state.days[state.selectedDate]) {
      state.selectedDate = nextBusinessDates(DAY_COUNT)[0] || "";
    }

    markDirty(false);
    renderDateList();
    renderSlotGrid();
    renderRules();
    renderRuleDayChips();
  }

  async function saveSchedule() {
    state.saving = true;
    updateSaveState();
    setEditorStatus("Enregistrement en cours...");

    try {
      const response = await fetch("/api/admin/schedule", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          days: state.days,
          rules: state.rules,
          outlookIcsUrl: state.outlookIcsUrl
        })
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error("unauthorized");
        throw new Error("save_failed");
      }

      const payload = await response.json();
      state.days = ensureDateRange(payload && payload.days && typeof payload.days === "object" ? payload.days : state.days);
      state.rules = normalizeRules(payload && Array.isArray(payload.rules) ? payload.rules : state.rules);
      state.outlookIcsUrl = String(payload && payload.outlookIcsUrl ? payload.outlookIcsUrl : state.outlookIcsUrl).trim();
      icsInput.value = state.outlookIcsUrl;

      markDirty(false);
      renderDateList();
      renderSlotGrid();
      renderRules();
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

  async function applyRules() {
    state.applyingRules = true;
    updateSaveState();
    setRulesStatus("Application des règles...");

    try {
      const response = await fetch("/api/admin/apply-rules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          rules: state.rules,
          days: state.days
        })
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error("unauthorized");
        throw new Error("apply_failed");
      }

      const payload = await response.json();
      state.days = ensureDateRange(payload && payload.days && typeof payload.days === "object" ? payload.days : state.days);
      state.rules = normalizeRules(payload && Array.isArray(payload.rules) ? payload.rules : state.rules);
      state.outlookIcsUrl = String(payload && payload.outlookIcsUrl ? payload.outlookIcsUrl : state.outlookIcsUrl).trim();
      if (state.outlookIcsUrl) icsInput.value = state.outlookIcsUrl;

      markDirty(false);
      renderDateList();
      renderSlotGrid();
      renderRules();
      setRulesStatus("Règles appliquées au planning.", "success");
      setEditorStatus("Planning mis à jour avec les règles.", "success");
    } catch (error) {
      if (error.message === "unauthorized") {
        showLoginPanel();
        setLoginStatus("Session expirée. Reconnectez-vous.", "error");
      } else {
        setRulesStatus("Impossible d'appliquer les règles.", "error");
      }
    } finally {
      state.applyingRules = false;
      updateSaveState();
    }
  }

  async function syncOutlook() {
    state.syncing = true;
    updateSaveState();
    setSyncStatus("Synchronisation Outlook en cours...");

    const provided = String(icsInput.value || "").trim();

    try {
      const response = await fetch("/api/admin/outlook-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          icsUrl: provided,
          days: state.days,
          rules: state.rules
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) throw new Error("unauthorized");
        const msg = payload && payload.message ? payload.message : "Synchronisation Outlook impossible.";
        throw new Error(msg);
      }

      state.days = ensureDateRange(payload && payload.days && typeof payload.days === "object" ? payload.days : state.days);
      state.rules = normalizeRules(payload && Array.isArray(payload.rules) ? payload.rules : state.rules);
      state.outlookIcsUrl = String(payload && payload.outlookIcsUrl ? payload.outlookIcsUrl : provided).trim();
      icsInput.value = state.outlookIcsUrl;

      markDirty(false);
      renderDateList();
      renderSlotGrid();
      renderRules();

      const eventCount = Number(payload.eventCount || 0);
      const blockedSlots = Number(payload.blockedSlots || 0);
      setSyncStatus(`Synchronisé: ${eventCount} événement(s), ${blockedSlots} créneau(x) bloqué(s).`, "success");
      setEditorStatus("Planning mis à jour après synchronisation Outlook.", "success");
    } catch (error) {
      if (error.message === "unauthorized") {
        showLoginPanel();
        setLoginStatus("Session expirée. Reconnectez-vous.", "error");
      } else {
        setSyncStatus(error.message || "Synchronisation Outlook impossible.", "error");
      }
    } finally {
      state.syncing = false;
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
      setSyncStatus(state.outlookIcsUrl ? "URL Outlook chargée." : "Ajoutez une URL ICS Outlook pour activer la synchro.");
      setRulesStatus("Vous pouvez ajouter des règles puis les appliquer.");
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
    setSyncStatus("");
    setRulesStatus("");
  });

  saveButton.addEventListener("click", async () => {
    if (!state.dirty || state.saving || state.syncing || state.applyingRules) return;
    await saveSchedule();
  });

  syncForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await syncOutlook();
  });

  ruleDaysWrap.querySelectorAll("[data-rule-day]").forEach((button) => {
    button.addEventListener("click", () => {
      const day = button.getAttribute("data-rule-day") || "";
      if (!RULE_DAYS.includes(day)) return;

      const set = new Set(state.newRule.days);
      if (set.has(day)) {
        set.delete(day);
      } else {
        set.add(day);
      }
      state.newRule.days = RULE_DAYS.filter((entry) => set.has(entry));
      renderRuleDayChips();
    });
  });

  ruleStartSelect.addEventListener("change", () => {
    state.newRule.startTime = ruleStartSelect.value;
  });

  ruleEndSelect.addEventListener("change", () => {
    state.newRule.endTime = ruleEndSelect.value;
  });

  ruleTypeSelect.addEventListener("change", () => {
    state.newRule.type = ruleTypeSelect.value === "available" ? "available" : "unavailable";
  });

  ruleAddButton.addEventListener("click", () => {
    const candidate = normalizeRules([
      {
        id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        days: state.newRule.days,
        startTime: state.newRule.startTime,
        endTime: state.newRule.endTime,
        type: state.newRule.type
      }
    ])[0];

    if (!candidate) {
      setRulesStatus("Règle invalide. Vérifiez jours/horaires.", "error");
      return;
    }

    state.rules = [...state.rules, candidate];
    markDirty(true);
    renderRules();
    setRulesStatus("Règle ajoutée. Enregistrez ou appliquez.");

    state.newRule = {
      days: [],
      startTime: "08:00",
      endTime: "20:00",
      type: "unavailable"
    };
    ruleStartSelect.value = state.newRule.startTime;
    ruleEndSelect.value = state.newRule.endTime;
    ruleTypeSelect.value = state.newRule.type;
    renderRuleDayChips();
  });

  rulesApplyButton.addEventListener("click", async () => {
    if (state.syncing || state.saving || state.applyingRules) return;
    await applyRules();
  });

  populateTimeOptions();
  ruleTypeSelect.value = state.newRule.type;
  renderRuleDayChips();
  renderRules();
  updateSaveState();

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
    try {
      await fetchSchedule();
      setEditorStatus("Planning chargé.", "success");
      setSyncStatus(state.outlookIcsUrl ? "URL Outlook chargée." : "Ajoutez une URL ICS Outlook pour activer la synchro.");
      setRulesStatus("Vous pouvez ajouter des règles puis les appliquer.");
    } catch (error) {
      if (error.message === "unauthorized") {
        showLoginPanel();
        setLoginStatus("Session expirée. Reconnectez-vous.", "error");
      } else {
        setLoginStatus("Impossible de charger le planning.", "error");
      }
    }
  })();
})();
