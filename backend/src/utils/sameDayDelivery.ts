/** Same cutoff rules as the storefront (`frontend/src/utils/sameDayDelivery.ts`). Keep both in sync. */
export type SameDayConfig = {
  enabled: boolean;
  cutoffTime: string;
  timezone: string;
  weekdays: number[];
  postalPrefixes?: string[];
};

export type SameDayStatus = {
  enabled: boolean;
  /** Same-day window is open right now (applicable day + before cutoff). */
  sameDayAvailable: boolean;
  msRemaining: number;
  hours: number;
  minutes: number;
  seconds: number;
  cutoffLabel: string;
  nextCutoffAt: Date | null;
  /** Human message key for UI. */
  mode: "same_day" | "next_day" | "disabled" | "unavailable_area";
};

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function parseCutoff(cutoffTime: string): { hour: number; minute: number } | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(cutoffTime || "").trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/** Local calendar parts for `date` in an IANA timezone. */
export function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: weekdayMap[get("weekday")] ?? date.getUTCDay(),
  };
}

/**
 * Convert a wall-clock datetime in `timeZone` to a UTC Date.
 * Uses iterative offset resolution (DST-safe for typical store hours).
 */
export function zonedWallTimeToUtc(
  parts: { year: number; month: number; day: number; hour: number; minute: number; second?: number },
  timeZone: string,
): Date {
  const second = parts.second ?? 0;
  let utc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, second);
  for (let i = 0; i < 3; i += 1) {
    const asLocal = zonedParts(new Date(utc), timeZone);
    const wanted = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, second);
    const got = Date.UTC(
      asLocal.year,
      asLocal.month - 1,
      asLocal.day,
      asLocal.hour,
      asLocal.minute,
      asLocal.second,
    );
    utc += wanted - got;
  }
  return new Date(utc);
}

export function addCalendarDays(
  parts: { year: number; month: number; day: number },
  days: number,
): { year: number; month: number; day: number; weekday: number } {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
    weekday: base.getUTCDay(),
  };
}

/** Format a calendar day in an IANA timezone (not the browser's local zone). */
export function formatZonedCalendarDate(
  parts: { year: number; month: number; day: number },
  timeZone: string,
): string {
  const noon = zonedWallTimeToUtc(
    { year: parts.year, month: parts.month, day: parts.day, hour: 12, minute: 0, second: 0 },
    timeZone,
  );
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(noon);
}

/**
 * Estimated delivery label synced with the same-day cutoff timer.
 * - Timer running (same_day) → today's date in the admin timezone
 * - Timer stopped (next_day) → tomorrow's date in the admin timezone
 * - Otherwise → fallback days from "today" in that timezone
 */
export function resolveEstimatedDeliveryLabel(input: {
  status: SameDayStatus | null | undefined;
  timeZone: string;
  fallbackDaysFromNow?: number;
  now?: Date;
}): string {
  const timeZone = input.timeZone || "America/Edmonton";
  const now = input.now || new Date();
  const today = zonedParts(now, timeZone);

  if (input.status?.mode === "same_day" && input.status.sameDayAvailable) {
    return formatZonedCalendarDate(today, timeZone);
  }

  if (input.status?.mode === "next_day") {
    return formatZonedCalendarDate(addCalendarDays(today, 1), timeZone);
  }

  const days = Math.max(1, Math.floor(input.fallbackDaysFromNow || 5));
  return formatZonedCalendarDate(addCalendarDays(today, days), timeZone);
}

export function formatCutoffLabel(cutoffTime: string, timeZone: string): string {
  const parsed = parseCutoff(cutoffTime);
  if (!parsed) return cutoffTime;
  const probe = zonedWallTimeToUtc(
    {
      year: 2024,
      month: 6,
      day: 15,
      hour: parsed.hour,
      minute: parsed.minute,
    },
    timeZone,
  );
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(probe);
}

export function normalizePostalPrefix(postalCode: string): string {
  return String(postalCode || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .slice(0, 3);
}

export function isPostalEligible(postalCode: string | undefined, prefixes: string[] | undefined): boolean {
  if (!prefixes?.length) return true;
  if (!postalCode) return true; // unknown area — still show timer; checkout enforces delivery areas
  const needle = normalizePostalPrefix(postalCode);
  return prefixes.some((prefix) => needle.startsWith(normalizePostalPrefix(prefix)));
}

export function getSameDayStatus(
  config: SameDayConfig,
  now: Date = new Date(),
  opts?: { postalCode?: string },
): SameDayStatus {
  const empty: SameDayStatus = {
    enabled: false,
    sameDayAvailable: false,
    msRemaining: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    cutoffLabel: "",
    nextCutoffAt: null,
    mode: "disabled",
  };

  if (!config.enabled) return empty;

  const parsed = parseCutoff(config.cutoffTime);
  const timeZone = config.timezone || "America/Edmonton";
  const weekdays = (config.weekdays?.length ? config.weekdays : [1, 2, 3, 4, 5, 6]).map(Number);
  if (!parsed) return { ...empty, enabled: true, mode: "next_day", cutoffLabel: config.cutoffTime };

  const cutoffLabel = formatCutoffLabel(config.cutoffTime, timeZone);

  if (!isPostalEligible(opts?.postalCode, config.postalPrefixes)) {
    return {
      enabled: true,
      sameDayAvailable: false,
      msRemaining: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      cutoffLabel,
      nextCutoffAt: null,
      mode: "unavailable_area",
    };
  }

  const local = zonedParts(now, timeZone);
  const todayApplicable = weekdays.includes(local.weekday);
  const minutesNow = local.hour * 60 + local.minute;
  const minutesCutoff = parsed.hour * 60 + parsed.minute;
  const beforeCutoff = minutesNow < minutesCutoff;

  if (todayApplicable && beforeCutoff) {
    const cutoffAt = zonedWallTimeToUtc(
      {
        year: local.year,
        month: local.month,
        day: local.day,
        hour: parsed.hour,
        minute: parsed.minute,
        second: 0,
      },
      timeZone,
    );
    const msRemaining = Math.max(0, cutoffAt.getTime() - now.getTime());
    const totalSeconds = Math.floor(msRemaining / 1000);
    return {
      enabled: true,
      sameDayAvailable: msRemaining > 0,
      msRemaining,
      hours: Math.floor(totalSeconds / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
      cutoffLabel,
      nextCutoffAt: cutoffAt,
      mode: msRemaining > 0 ? "same_day" : "next_day",
    };
  }

  // Find next applicable weekday's cutoff (informational; UI shows next-day copy).
  let nextCutoffAt: Date | null = null;
  for (let offset = todayApplicable && !beforeCutoff ? 1 : 0; offset <= 8; offset += 1) {
    const day = addCalendarDays(local, offset);
    if (!weekdays.includes(day.weekday)) continue;
    if (offset === 0 && !beforeCutoff) continue;
    nextCutoffAt = zonedWallTimeToUtc(
      {
        year: day.year,
        month: day.month,
        day: day.day,
        hour: parsed.hour,
        minute: parsed.minute,
        second: 0,
      },
      timeZone,
    );
    break;
  }

  return {
    enabled: true,
    sameDayAvailable: false,
    msRemaining: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    cutoffLabel,
    nextCutoffAt,
    mode: "next_day",
  };
}

export function formatCountdown(status: SameDayStatus): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  if (status.hours > 0) return `${status.hours}h ${pad(status.minutes)}m ${pad(status.seconds)}s`;
  return `${pad(status.minutes)}m ${pad(status.seconds)}s`;
}

export function weekdayLabels(weekdays: number[]): string {
  const sorted = [...new Set(weekdays)].sort((a, b) => a - b);
  if (sorted.length === 7) return "Every day";
  if (sorted.join(",") === "1,2,3,4,5,6") return "Mon–Sat";
  if (sorted.join(",") === "1,2,3,4,5") return "Mon–Fri";
  return sorted.map((d) => WEEKDAY_SHORT[d] || "?").join(", ");
}
