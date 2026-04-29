import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import {
  EventPrefDto,
  UpdateEventNotificationsDto,
} from "./update-event-notifications.dto";

describe("EventPrefDto validation", () => {
  it("accepts a valid event preference", async () => {
    const dto = plainToInstance(EventPrefDto, {
      event: "ORDER_FILLED",
      inApp: true,
      email: false,
      push: true,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects an invalid event name", async () => {
    const dto = plainToInstance(EventPrefDto, {
      event: "<svg onload=alert(1)>",
      inApp: true,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("event");
  });

  it("rejects non-boolean inApp value", async () => {
    const dto = plainToInstance(EventPrefDto, {
      event: "ORDER_FILLED",
      inApp: "true",
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === "inApp")).toBe(true);
  });
});

describe("UpdateEventNotificationsDto validation", () => {
  it("accepts valid preferences array", async () => {
    const dto = plainToInstance(UpdateEventNotificationsDto, {
      preferences: [
        { event: "ORDER_FILLED", inApp: true },
        { event: "STRATEGY_ERROR", email: false },
      ],
      emailDigest: "daily",
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("accepts the notification events and digest values emitted by the user app", async () => {
    const dto = plainToInstance(UpdateEventNotificationsDto, {
      preferences: [
        { event: "ORDER_REJECTED", inApp: true, email: true, push: false },
        { event: "POSITION_CLOSED", inApp: true, email: false, push: false },
        { event: "STRATEGY_PAUSED", inApp: true, email: false, push: false },
        { event: "COPY_TRADE", inApp: true, email: false, push: false },
        { event: "FOLLOWER_NEW", inApp: true, email: false, push: false },
        { event: "REVIEW_RECEIVED", inApp: true, email: false, push: false },
      ],
      emailDigest: "DAILY",
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects preferences array exceeding 50 elements", async () => {
    const prefs = Array.from({ length: 51 }, (_, i) => ({
      event: "ORDER_FILLED",
      inApp: i % 2 === 0,
    }));
    const dto = plainToInstance(UpdateEventNotificationsDto, {
      preferences: prefs,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects invalid emailDigest value", async () => {
    const dto = plainToInstance(UpdateEventNotificationsDto, {
      emailDigest: "every_hour",
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("emailDigest");
  });
});
