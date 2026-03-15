const SCHEDULE_KEY = "alexandre_schedule_v1";
const HORIZON_DAYS = 120;
const MEMORY_KEY = "__alexandre_schedule_memory__";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[03]0$/;
const RULE_DAY_VALUES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const RULE_DAY_SET = new Set(RULE_DAY_VALUES);
const INDEX_TO_RULE_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildSlotUniverse() {
  const slots = [];
  for (let hour = 8; hour <= 20; hour += 1) {
    slots.push(`${String(hour).padStart(2, "0")}:00`);
    if (hour < 20) slots.push(`${String(hour).padStart(2, "0")}:30`);
  }
  return slots;
}

const SLOT_UNIVERSE = buildSlotUniverse();
const DEFAULT_DAY_SLOTS = [...SLOT_UNIVERSE];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toLocalISODate(date) {
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

export function normalizeSlotList(slots) {
  if (!Array.isArray(slots)) return [];
  const unique = new Set();

  slots.forEach((slot) => {
    const normalized = String(slot || "").trim();
    if (!TIME_RE.test(normalized)) return;
    unique.add(normalized);
  });

  return sortSlots(Array.from(unique));
}

function normalizeRule(rule) {
  const safe = rule && typeof rule === "object" ? rule : {};
  const idRaw = String(safe.id || "").trim();
  const id = idRaw || `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const days = Array.isArray(safe.days)
    ? Array.from(
        new Set(
          safe.days
            .map((entry) => String(entry || "").trim())
            .filter((entry) => RULE_DAY_SET.has(entry))
        )
      )
    : [];

  const startTime = String(safe.startTime || "").trim();
  const endTime = String(safe.endTime || "").trim();
  const type = safe.type === "available" ? "available" : "unavailable";

  if (!days.length || !TIME_RE.test(startTime) || !TIME_RE.test(endTime) || !(startTime < endTime)) {
    return null;
  }

  return { id, days, startTime, endTime, type };
}

export function normalizeRules(rules) {
  if (!Array.isArray(rules)) return [];

  const normalized = [];
  const seen = new Set();
  rules.forEach((rule) => {
    const parsed = normalizeRule(rule);
    if (!parsed) return;
    if (seen.has(parsed.id)) {
      parsed.id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    seen.add(parsed.id);
    normalized.push(parsed);
  });

  return normalized;
}

function shouldAllowInsecureIcs(env) {
  return String(env.ALLOW_INSECURE_ICS || "") === "1";
}

export function normalizeOutlookIcsUrl(value, env) {
  let raw = String(value || "").trim();
  if (!raw) return "";

  if (raw.startsWith("webcal://")) {
    raw = `https://${raw.slice("webcal://".length)}`;
  }

  try {
    const url = new URL(raw);
    const allowInsecure = shouldAllowInsecureIcs(env);
    if (allowInsecure) {
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    } else if (url.protocol !== "https:") {
      return "";
    }
    return url.toString();
  } catch (error) {
    return "";
  }
}

function buildDefaultDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = {};
  for (let offset = 0; offset <= HORIZON_DAYS; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    if (!isWeekday(date)) continue;
    days[toLocalISODate(date)] = [...DEFAULT_DAY_SLOTS];
  }

  return days;
}

function ensureHorizon(days) {
  const hydrated = { ...days };
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = 0; offset <= HORIZON_DAYS; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    if (!isWeekday(date)) continue;
    const key = toLocalISODate(date);
    if (!Array.isArray(hydrated[key])) {
      hydrated[key] = [...DEFAULT_DAY_SLOTS];
    }
    hydrated[key] = normalizeSlotList(hydrated[key]);
  }

  return hydrated;
}

function dayNameFromDateKey(dateKey) {
  if (!DAY_RE.test(String(dateKey || ""))) return "";
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  if (!year || !month || !day) return "";
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return INDEX_TO_RULE_DAY[weekday] || "";
}

function slotsForRule(rule) {
  return SLOT_UNIVERSE.filter((slot) => slot >= rule.startTime && slot < rule.endTime);
}

export function applyRulesToDays(days, rules) {
  const normalizedRules = normalizeRules(rules);
  if (!normalizedRules.length) return clone(days);

  const nextDays = {};
  Object.entries(days || {}).forEach(([dateKey, slots]) => {
    if (!DAY_RE.test(dateKey)) return;

    const dayName = dayNameFromDateKey(dateKey);
    const set = new Set(normalizeSlotList(slots));

    normalizedRules.forEach((rule) => {
      if (!rule.days.includes(dayName)) return;
      const targets = slotsForRule(rule);
      if (rule.type === "available") {
        targets.forEach((slot) => set.add(slot));
      } else {
        targets.forEach((slot) => set.delete(slot));
      }
    });

    nextDays[dateKey] = sortSlots(Array.from(set));
  });

  return nextDays;
}

export function normalizeSchedule(raw, env) {
  const safe = raw && typeof raw === "object" ? raw : {};
  const sourceDays = safe.days && typeof safe.days === "object" ? safe.days : {};
  const normalizedDays = {};

  Object.entries(sourceDays).forEach(([dateKey, slots]) => {
    if (!DAY_RE.test(dateKey)) return;
    normalizedDays[dateKey] = normalizeSlotList(slots);
  });

  const hasDays = Object.keys(normalizedDays).length > 0;
  const rules = normalizeRules(safe.rules);
  const mergedOutlookUrl = safe.outlookIcsUrl !== undefined ? safe.outlookIcsUrl : env.OUTLOOK_ICS_URL;

  return {
    version: 2,
    timezone: "Europe/Paris",
    slotDurationMinutes: 60,
    outlookIcsUrl: normalizeOutlookIcsUrl(mergedOutlookUrl, env),
    rules,
    days: ensureHorizon(hasDays ? normalizedDays : buildDefaultDays())
  };
}

function hasKV(env) {
  return Boolean(env.SCHEDULE_KV && typeof env.SCHEDULE_KV.get === "function" && typeof env.SCHEDULE_KV.put === "function");
}

async function readScheduleFromKV(env) {
  if (!hasKV(env)) return null;

  try {
    const value = await env.SCHEDULE_KV.get(SCHEDULE_KEY, { type: "json" });
    return value && typeof value === "object" ? value : null;
  } catch (error) {
    return null;
  }
}

async function writeScheduleToKV(env, schedule) {
  if (!hasKV(env)) return false;
  try {
    await env.SCHEDULE_KV.put(SCHEDULE_KEY, JSON.stringify(schedule));
    return true;
  } catch (error) {
    return false;
  }
}

function getMemorySchedule(env) {
  if (!globalThis[MEMORY_KEY]) {
    globalThis[MEMORY_KEY] = normalizeSchedule(
      {
        days: buildDefaultDays(),
        rules: [],
        outlookIcsUrl: env.OUTLOOK_ICS_URL || ""
      },
      env
    );
  }

  return globalThis[MEMORY_KEY];
}

function setMemorySchedule(schedule) {
  globalThis[MEMORY_KEY] = schedule;
}

export async function readSchedule(env) {
  const fromKV = await readScheduleFromKV(env);
  const source = fromKV || getMemorySchedule(env);
  const normalized = normalizeSchedule(source, env);
  setMemorySchedule(normalized);

  if (!fromKV && hasKV(env)) {
    await writeScheduleToKV(env, normalized);
  }

  return clone(normalized);
}

export async function writeSchedule(env, raw) {
  const current = await readSchedule(env);
  const safe = raw && typeof raw === "object" ? raw : {};

  const merged = {
    ...current,
    ...safe,
    days: safe.days && typeof safe.days === "object" ? safe.days : current.days,
    rules: Array.isArray(safe.rules) ? safe.rules : current.rules,
    outlookIcsUrl: safe.outlookIcsUrl !== undefined ? safe.outlookIcsUrl : current.outlookIcsUrl
  };

  const normalized = normalizeSchedule(merged, env);
  setMemorySchedule(normalized);
  await writeScheduleToKV(env, normalized);
  return clone(normalized);
}

export async function reserveSlot(env, dateKey, time) {
  if (!DAY_RE.test(String(dateKey || "")) || !TIME_RE.test(String(time || ""))) {
    return { ok: false, reason: "invalid_input", schedule: await readSchedule(env) };
  }

  const current = await readSchedule(env);
  const slots = normalizeSlotList(current.days[dateKey] || []);
  if (!slots.includes(time)) {
    return { ok: false, reason: "slot_unavailable", schedule: current };
  }

  current.days[dateKey] = slots.filter((slot) => slot !== time);
  const saved = await writeSchedule(env, current);
  return { ok: true, schedule: saved };
}

export { DAY_RE, TIME_RE, RULE_DAY_VALUES, SLOT_UNIVERSE };
