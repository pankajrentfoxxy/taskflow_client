// Working-hours SLA engine.
// Company timezone: Asia/Kolkata (UTC+5:30, no DST). Working: Mon-Sat 10:00-19:00.
const IST_OFFSET_MS = 5.5 * 3600 * 1000;
export const WORK_START_MIN = 10 * 60; // 10:00
export const WORK_END_MIN = 19 * 60; // 19:00
const WORKING_DAYS = new Set([1, 2, 3, 4, 5, 6]); // Mon..Sat (0 = Sun)

function istParts(ms) {
  const d = new Date(ms + IST_OFFSET_MS);
  return {
    dow: d.getUTCDay(),
    minOfDay: d.getUTCHours() * 60 + d.getUTCMinutes(),
    dayStartMs: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - IST_OFFSET_MS,
  };
}

/** Advance cursor to the next moment inside working hours (>= cursor). */
export function nextWorkingMoment(ms) {
  for (let guard = 0; guard < 14; guard++) {
    const { dow, minOfDay, dayStartMs } = istParts(ms);
    if (!WORKING_DAYS.has(dow)) {
      ms = dayStartMs + 24 * 3600 * 1000 + WORK_START_MIN * 60 * 1000;
      continue;
    }
    if (minOfDay < WORK_START_MIN) return dayStartMs + WORK_START_MIN * 60 * 1000;
    if (minOfDay >= WORK_END_MIN) {
      ms = dayStartMs + 24 * 3600 * 1000 + WORK_START_MIN * 60 * 1000;
      continue;
    }
    return ms;
  }
  return ms;
}

/** Add N working minutes to a timestamp, skipping nights, Sundays. */
export function addWorkingMinutes(startMs, minutes) {
  let cursor = nextWorkingMoment(startMs);
  let remaining = minutes;
  for (let guard = 0; guard < 60 && remaining > 0; guard++) {
    const { minOfDay } = istParts(cursor);
    const leftToday = WORK_END_MIN - minOfDay;
    const take = Math.min(remaining, leftToday);
    cursor += take * 60 * 1000;
    remaining -= take;
    if (remaining > 0) cursor = nextWorkingMoment(cursor);
  }
  return cursor;
}

export function isWorkingTime(ms) {
  const { dow, minOfDay } = istParts(ms);
  return WORKING_DAYS.has(dow) && minOfDay >= WORK_START_MIN && minOfDay < WORK_END_MIN;
}
