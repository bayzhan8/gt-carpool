const TIME_ZONE = "America/New_York";
const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type LocalTimeResult =
  { ok: true; iso: string } | { ok: false; reason: "nonexistent" | "invalid" };

function atlantaDateTimeParts(date: Date): Record<string, string> {
  return Object.fromEntries(
    DATE_FORMAT.formatToParts(date).map(({ type, value }) => [type, value]),
  );
}

function dateKey(parts: Record<string, string>): string {
  return `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`;
}

export function atlantaLocalToInstant(
  date: string,
  time: string,
): LocalTimeResult {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);

  if (!dateMatch || !timeMatch) {
    return { ok: false, reason: "invalid" };
  }

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const local = new Date(0);

  local.setUTCFullYear(year, month - 1, day);
  local.setUTCHours(hour, minute, 0, 0);

  if (
    local.getUTCFullYear() !== year ||
    local.getUTCMonth() !== month - 1 ||
    local.getUTCDate() !== day
  ) {
    return { ok: false, reason: "invalid" };
  }

  const matchingInstants = [4, 5]
    .map((offset) => new Date(local.getTime() + offset * 60 * 60 * 1000))
    .filter((instant) => {
      const parts = atlantaDateTimeParts(instant);
      return (
        Number(parts.year) === year &&
        Number(parts.month) === month &&
        Number(parts.day) === day &&
        Number(parts.hour) === hour &&
        Number(parts.minute) === minute
      );
    })
    .sort((left, right) => left.getTime() - right.getTime());

  if (matchingInstants.length === 0) {
    return { ok: false, reason: "nonexistent" };
  }

  return { ok: true, iso: matchingInstants[0].toISOString() };
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDayHeader(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

export function atlantaDateKey(iso: string): string {
  return dateKey(atlantaDateTimeParts(new Date(iso)));
}

export function atlantaParts(iso: string): { date: string; time: string } {
  const parts = atlantaDateTimeParts(new Date(iso));
  return {
    date: dateKey(parts),
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function next14Days(now: Date = new Date()): string[] {
  const [year, month, day] = atlantaDateKey(now.toISOString())
    .split("-")
    .map(Number);

  return Array.from({ length: 14 }, (_, offset) => {
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day + offset);
    date.setUTCHours(0, 0, 0, 0);
    return date.toISOString().slice(0, 10);
  });
}
