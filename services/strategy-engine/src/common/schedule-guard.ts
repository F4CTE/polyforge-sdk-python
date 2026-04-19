import { ScheduleConfig } from "../blocks/block.types";

function toMinuteOfDay(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getMinuteInTimezone(now: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function getDayInTimezone(now: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  });
  const day = formatter.format(now);
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return dayMap[day] ?? 0;
}

export function isWithinSchedule(schedule: ScheduleConfig, now: Date): boolean {
  if (schedule.type === "time_range") {
    return isWithinTimeRange(schedule, now);
  }
  if (schedule.type === "cron") {
    return matchesCronMinute(
      schedule.cron ?? "* * * * *",
      now,
      schedule.timezone,
    );
  }
  return true;
}

function isWithinTimeRange(schedule: ScheduleConfig, now: Date): boolean {
  const tz = schedule.timezone ?? "UTC";

  if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
    const currentDay = getDayInTimezone(now, tz);
    if (!schedule.daysOfWeek.includes(currentDay)) return false;
  }

  if (!schedule.startTime || !schedule.endTime) return true;

  const currentMinute = getMinuteInTimezone(now, tz);
  const start = toMinuteOfDay(schedule.startTime);
  const end = toMinuteOfDay(schedule.endTime);

  if (start <= end) {
    return currentMinute >= start && currentMinute < end;
  }
  // Overnight range (e.g., 22:00-06:00)
  return currentMinute >= start || currentMinute < end;
}

function matchesCronMinute(
  cron: string,
  now: Date,
  timezone?: string,
): boolean {
  const tz = timezone ?? "UTC";
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return true;

  const [minPart, hourPart, , , dowPart] = parts;

  const currentMinute = getMinuteInTimezone(now, tz);
  const hour = Math.floor(currentMinute / 60);
  const minute = currentMinute % 60;
  const day = getDayInTimezone(now, tz);

  return (
    matchesCronField(minPart, minute) &&
    matchesCronField(hourPart, hour) &&
    matchesCronField(dowPart, day)
  );
}

function matchesCronField(field: string, value: number): boolean {
  if (field === "*") return true;

  for (const part of field.split(",")) {
    if (part.includes("/")) {
      const [range, stepStr] = part.split("/");
      const step = Number(stepStr);
      if (range === "*") {
        if (value % step === 0) return true;
      }
    } else if (part.includes("-")) {
      const [lo, hi] = part.split("-").map(Number);
      if (value >= lo && value <= hi) return true;
    } else {
      if (Number(part) === value) return true;
    }
  }
  return false;
}
