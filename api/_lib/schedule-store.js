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
    if (hour < 20) {
      slots.push(`${String(hour).padStart(2, "0")}:30`);
    }
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

function normalizeSlotList(slots) {
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

  return {
    id,
    days,
    startTime,
    endTime,
    type
  };
}

function normalizeRules(rules) {
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

function normalizeOutlookIcsUrl(value) {
  let raw = String(value || "").trim();
  if (!raw) return "";

  if (raw.startsWith("webcal://")) {
    raw = `https://${raw.slice("webcal://".length)}`;
  }

  try {
    const url = new URL(raw);
    const isProd = process.env.NODE_ENV === "production";
    if (isProd && url.protocol !== "https:") return "";
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
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

function applyRulesToDays(days, rules) {
  const normalizedRules = normalizeRules(rules);
  if (!normalizedRules.length) {
    return clone(days);
  }

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

function normalizeSchedule(raw) {
  const safe = raw && typeof raw === "object" ? raw : {};
  const sourceDays = safe.days && typeof safe.days === "object" ? safe.days : {};
  const normalizedDays = {};

  Object.entries(sourceDays).forEach(([dateKey, slots]) => {
    if (!DAY_RE.test(dateKey)) return;
    normalizedDays[dateKey] = normalizeSlotList(slots);
  });

  const hasDays = Object.keys(normalizedDays).length > 0;
  const rules = normalizeRules(safe.rules);
  const mergedOutlookUrl = safe.outlookIcsUrl !== undefined ? safe.outlookIcsUrl : process.env.OUTLOOK_ICS_URL;

  return {
    version: 2,
    timezone: "Europe/Paris",
    slotDurationMinutes: 60,
    outlookIcsUrl: normalizeOutlookIcsUrl(mergedOutlookUrl),
    rules,
    days: ensureHorizon(hasDays ? normalizedDays : buildDefaultDays())
  };
}

function hasKV() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function runKVPipeline(commands) {
  const response = await fetch(`${process.env.KV_REST_API_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(commands)
  });

  if (!response.ok) {
    throw new Error(`kv_http_${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

async function readScheduleFromKV() {
  if (!hasKV()) return null;

  try {
    const [result] = await runKVPipeline([["GET", SCHEDULE_KEY]]);
    if (!result || result.result == null) return null;

    if (typeof result.result === "string") {
      return JSON.parse(result.result);
    }

    return result.result;
  } catch (error) {
    return null;
  }
}

async function writeScheduleToKV(schedule) {
  if (!hasKV()) return false;

  try {
    await runKVPipeline([["SET", SCHEDULE_KEY, JSON.stringify(schedule)]]);
    return true;
  } catch (error) {
    return false;
  }
}

function getMemorySchedule() {
  if (!globalThis[MEMORY_KEY]) {
    globalThis[MEMORY_KEY] = normalizeSchedule({
      days: buildDefaultDays(),
      rules: [],
      outlookIcsUrl: process.env.OUTLOOK_ICS_URL || ""
    });
  }

  return globalThis[MEMORY_KEY];
}

function setMemorySchedule(schedule) {
  globalThis[MEMORY_KEY] = schedule;
}

async function readSchedule() {
  const fromKV = await readScheduleFromKV();
  const source = fromKV || getMemorySchedule();
  const normalized = normalizeSchedule(source);
  setMemorySchedule(normalized);

  if (!fromKV && hasKV()) {
    await writeScheduleToKV(normalized);
  }

  return clone(normalized);
}

async function writeSchedule(raw) {
  const current = await readSchedule();
  const safe = raw && typeof raw === "object" ? raw : {};

  const merged = {
    ...current,
    ...safe,
    days: safe.days && typeof safe.days === "object" ? safe.days : current.days,
    rules: Array.isArray(safe.rules) ? safe.rules : current.rules,
    outlookIcsUrl: safe.outlookIcsUrl !== undefined ? safe.outlookIcsUrl : current.outlookIcsUrl
  };

  const normalized = normalizeSchedule(merged);
  setMemorySchedule(normalized);
  await writeScheduleToKV(normalized);
  return clone(normalized);
}

async function reserveSlot(dateKey, time) {
  if (!DAY_RE.test(String(dateKey || "")) || !TIME_RE.test(String(time || ""))) {
    return { ok: false, reason: "invalid_input", schedule: await readSchedule() };
  }

  const current = await readSchedule();
  const slots = normalizeSlotList(current.days[dateKey] || []);
  if (!slots.includes(time)) {
    return { ok: false, reason: "slot_unavailable", schedule: current };
  }

  current.days[dateKey] = slots.filter((slot) => slot !== time);
  const saved = await writeSchedule(current);
  return { ok: true, schedule: saved };
}

module.exports = {
  DAY_RE,
  TIME_RE,
  RULE_DAY_VALUES,
  SLOT_UNIVERSE,
  normalizeSlotList,
  normalizeRules,
  normalizeOutlookIcsUrl,
  applyRulesToDays,
  normalizeSchedule,
  readSchedule,
  writeSchedule,
  reserveSlot
};
