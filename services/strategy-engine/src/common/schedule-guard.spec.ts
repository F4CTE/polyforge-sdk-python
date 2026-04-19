import { describe, it, expect } from "vitest";
import { isWithinSchedule } from "./schedule-guard";
import type { ScheduleConfig } from "../blocks/block.types";

describe("isWithinSchedule — time_range", () => {
  const tuesday10am = new Date("2026-04-14T14:00:00Z"); // 10:00 AM ET on Tuesday

  it("returns true when within time range", () => {
    const schedule: ScheduleConfig = {
      type: "time_range",
      startTime: "09:30",
      endTime: "16:00",
      timezone: "America/New_York",
      daysOfWeek: [1, 2, 3, 4, 5],
    };
    expect(isWithinSchedule(schedule, tuesday10am)).toBe(true);
  });

  it("returns false when outside time range", () => {
    const earlyMorning = new Date("2026-04-14T05:00:00Z"); // 1:00 AM ET
    const schedule: ScheduleConfig = {
      type: "time_range",
      startTime: "09:30",
      endTime: "16:00",
      timezone: "America/New_York",
    };
    expect(isWithinSchedule(schedule, earlyMorning)).toBe(false);
  });

  it("returns false when day not in daysOfWeek", () => {
    const saturday = new Date("2026-04-18T14:00:00Z"); // Saturday
    const schedule: ScheduleConfig = {
      type: "time_range",
      startTime: "09:30",
      endTime: "16:00",
      timezone: "America/New_York",
      daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri only
    };
    expect(isWithinSchedule(schedule, saturday)).toBe(false);
  });

  it("handles overnight time range (start > end)", () => {
    const midnight = new Date("2026-04-14T05:00:00Z"); // 1:00 AM ET
    const schedule: ScheduleConfig = {
      type: "time_range",
      startTime: "22:00",
      endTime: "06:00",
      timezone: "America/New_York",
    };
    expect(isWithinSchedule(schedule, midnight)).toBe(true);
  });

  it("returns true when no start/end time specified", () => {
    const schedule: ScheduleConfig = {
      type: "time_range",
      timezone: "UTC",
    };
    expect(isWithinSchedule(schedule, new Date())).toBe(true);
  });

  it("returns true when daysOfWeek is empty", () => {
    const schedule: ScheduleConfig = {
      type: "time_range",
      startTime: "00:00",
      endTime: "23:59",
      timezone: "UTC",
      daysOfWeek: [],
    };
    expect(isWithinSchedule(schedule, new Date())).toBe(true);
  });
});

describe("isWithinSchedule — cron", () => {
  it("matches every-minute cron", () => {
    const schedule: ScheduleConfig = {
      type: "cron",
      cron: "* * * * *",
    };
    expect(isWithinSchedule(schedule, new Date())).toBe(true);
  });

  it("matches specific minute and hour", () => {
    const at1030utc = new Date("2026-04-14T10:30:00Z");
    const schedule: ScheduleConfig = {
      type: "cron",
      cron: "30 10 * * *",
      timezone: "UTC",
    };
    expect(isWithinSchedule(schedule, at1030utc)).toBe(true);
  });

  it("rejects non-matching minute", () => {
    const at1031utc = new Date("2026-04-14T10:31:00Z");
    const schedule: ScheduleConfig = {
      type: "cron",
      cron: "30 10 * * *",
      timezone: "UTC",
    };
    expect(isWithinSchedule(schedule, at1031utc)).toBe(false);
  });

  it("matches step pattern", () => {
    const at10utc = new Date("2026-04-14T10:00:00Z");
    const schedule: ScheduleConfig = {
      type: "cron",
      cron: "*/5 * * * *",
      timezone: "UTC",
    };
    expect(isWithinSchedule(schedule, at10utc)).toBe(true);
  });

  it("matches range pattern for day of week", () => {
    const tuesday = new Date("2026-04-14T10:00:00Z");
    const schedule: ScheduleConfig = {
      type: "cron",
      cron: "0 10 * * 1-5",
      timezone: "UTC",
    };
    expect(isWithinSchedule(schedule, tuesday)).toBe(true);
  });
});

describe("isWithinSchedule — unknown type", () => {
  it("returns true for unknown schedule type", () => {
    const schedule = { type: "unknown" } as unknown as ScheduleConfig;
    expect(isWithinSchedule(schedule, new Date())).toBe(true);
  });
});
