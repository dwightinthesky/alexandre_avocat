const SCHEDULE_KEY = "alexandre_schedule_v1";
const HORIZON_DAYS = 120;
const MEMORY_KEY = "__alexandre_schedule_memory__";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[03]0$/;
const DEFAULT_DAY_SLOTS = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];

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
  }

  return hydrated;
}

function normalizeSchedule(raw) {
  const safe = raw && typeof raw === "object" ? raw : {};
  const sourceDays = safe.days && typeof safe.days === "object" ? safe.days : {};
  const normalizedDays = {};

  Object.entries(sourceDays).forEach(([dateKey, slots]) => {
    if (!DAY_RE.test(dateKey)) return;
    normalizedDays[dateKey] = normalizeSlotList(slots);
  });

  return {
    version: 1,
    timezone: "Europe/Paris",
    slotDurationMinutes: 60,
    days: ensureHorizon(normalizedDays)
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
    globalThis[MEMORY_KEY] = normalizeSchedule({ days: buildDefaultDays() });
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
  const normalized = normalizeSchedule(raw);
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
  normalizeSchedule,
  readSchedule,
  writeSchedule,
  reserveSlot
};
