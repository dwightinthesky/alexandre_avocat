import { DAY_RE, normalizeOutlookIcsUrl, normalizeSlotList } from "./schedule-store.js";

const formatters = new Map();

function getFormatter(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(
      timeZone,
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      })
    );
  }
  return formatters.get(timeZone);
}

function getZonedParts(date, timeZone) {
  const parts = getFormatter(timeZone).formatToParts(date);
  const pick = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
    second: pick("second")
  };
}

function zonedLocalToDate(year, month, day, hour, minute, second, timeZone) {
  let guess = Date.UTC(year, month - 1, day, hour, minute, second || 0);
  const targetSerial = Date.UTC(year, month - 1, day, hour, minute, second || 0);

  for (let i = 0; i < 5; i += 1) {
    const zoned = getZonedParts(new Date(guess), timeZone);
    const zonedSerial = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second || 0);
    const diff = targetSerial - zonedSerial;
    if (diff === 0) break;
    guess += diff;
  }

  return new Date(guess);
}

function unfoldICS(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const unfolded = [];

  lines.forEach((line) => {
    if (!line) return;
    if ((line.startsWith(" ") || line.startsWith("\t")) && unfolded.length) {
      unfolded[unfolded.length - 1] += line.slice(1);
      return;
    }
    unfolded.push(line.trimEnd());
  });

  return unfolded;
}

function parseProperty(line) {
  const separator = line.indexOf(":");
  if (separator < 0) return null;

  const left = line.slice(0, separator);
  const value = line.slice(separator + 1).trim();
  const [name, ...rawParams] = left.split(";");

  const params = {};
  rawParams.forEach((entry) => {
    const i = entry.indexOf("=");
    if (i < 0) {
      params[entry.toUpperCase()] = true;
      return;
    }
    const key = entry.slice(0, i).toUpperCase();
    const v = entry.slice(i + 1);
    params[key] = v;
  });

  return { name: name.toUpperCase(), value, params };
}

function parseIcsDateValue(value, params, fallbackTimeZone) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const dateOnlyMatch = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    return {
      date: zonedLocalToDate(Number(y), Number(m), Number(d), 0, 0, 0, fallbackTimeZone),
      dateOnly: true
    };
  }

  const dateTimeMatch = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/i);
  if (!dateTimeMatch) return null;

  const [, y, m, d, hh, mm, ssRaw, zFlag] = dateTimeMatch;
  const second = Number(ssRaw || "0");

  if (zFlag) {
    return {
      date: new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), second)),
      dateOnly: false
    };
  }

  const tzid = String(params.TZID || params["X-LIC-LOCATION"] || fallbackTimeZone || "Europe/Paris").trim();
  return {
    date: zonedLocalToDate(Number(y), Number(m), Number(d), Number(hh), Number(mm), second, tzid || fallbackTimeZone),
    dateOnly: false
  };
}

function parseIcsEvents(icsText, fallbackTimeZone) {
  const lines = unfoldICS(icsText);
  const events = [];
  let current = null;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed.toUpperCase() === "BEGIN:VEVENT") {
      current = {};
      return;
    }

    if (trimmed.toUpperCase() === "END:VEVENT") {
      if (current && current.start instanceof Date) {
        let end = current.end;
        if (!(end instanceof Date) || Number.isNaN(end.getTime())) {
          const duration = current.startDateOnly ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
          end = new Date(current.start.getTime() + duration);
        }

        if (end.getTime() > current.start.getTime()) {
          events.push({ start: current.start, end });
        }
      }
      current = null;
      return;
    }

    if (!current) return;
    const prop = parseProperty(trimmed);
    if (!prop) return;

    if (prop.name === "DTSTART") {
      const parsed = parseIcsDateValue(prop.value, prop.params, fallbackTimeZone);
      if (parsed) {
        current.start = parsed.date;
        current.startDateOnly = parsed.dateOnly;
      }
      return;
    }

    if (prop.name === "DTEND") {
      const parsed = parseIcsDateValue(prop.value, prop.params, fallbackTimeZone);
      if (parsed) {
        current.end = parsed.date;
        current.endDateOnly = parsed.dateOnly;
      }
    }
  });

  return events;
}

function parseDateAndTimeToZonedDate(dateKey, time, timeZone) {
  if (!DAY_RE.test(String(dateKey || ""))) return null;
  const match = String(time || "").match(/^([01]\d|2[0-3]):([03]0)$/);
  if (!match) return null;

  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!year || !month || !day) return null;

  return zonedLocalToDate(year, month, day, hour, minute, 0, timeZone || "Europe/Paris");
}

async function fetchICS(icsUrl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 12000);

  try {
    const response = await fetch(icsUrl, {
      method: "GET",
      headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.8" },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`ics_http_${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function syncOutlookWithSchedule(schedule, providedUrl, env) {
  const sourceUrl = normalizeOutlookIcsUrl(providedUrl || schedule.outlookIcsUrl || env.OUTLOOK_ICS_URL, env);
  if (!sourceUrl) throw new Error("missing_ics_url");

  const icsText = await fetchICS(sourceUrl, 12000);
  const events = parseIcsEvents(icsText, schedule.timezone || "Europe/Paris");

  const nextDays = {};
  let blockedSlots = 0;

  Object.entries(schedule.days || {}).forEach(([dateKey, slots]) => {
    if (!DAY_RE.test(dateKey)) return;

    const normalizedSlots = normalizeSlotList(slots);
    const kept = normalizedSlots.filter((slot) => {
      const slotStart = parseDateAndTimeToZonedDate(dateKey, slot, schedule.timezone || "Europe/Paris");
      if (!(slotStart instanceof Date) || Number.isNaN(slotStart.getTime())) return false;

      const slotEnd = new Date(slotStart.getTime() + (schedule.slotDurationMinutes || 60) * 60 * 1000);
      const overlaps = events.some((event) => event.start < slotEnd && event.end > slotStart);
      if (overlaps) {
        blockedSlots += 1;
        return false;
      }
      return true;
    });

    nextDays[dateKey] = kept;
  });

  return {
    sourceUrl,
    eventCount: events.length,
    blockedSlots,
    days: nextDays
  };
}
