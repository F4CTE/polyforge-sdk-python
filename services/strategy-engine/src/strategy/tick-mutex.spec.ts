import { describe, it, expect } from "vitest";
import { TickMutex } from "./tick-mutex";

describe("TickMutex", () => {
  it("grants entry when not locked", () => {
    const mutex = new TickMutex();
    expect(mutex.tryEnter()).toBe(true);
    expect(mutex.isLocked).toBe(true);
  });

  it("denies entry while locked and sets pending", () => {
    const mutex = new TickMutex();
    mutex.tryEnter();
    expect(mutex.tryEnter()).toBe(false);
    expect(mutex.isLocked).toBe(true);
  });

  it("coalesces multiple concurrent callers into a single pending follow-up", () => {
    const mutex = new TickMutex();
    mutex.tryEnter();

    // Multiple callers arrive while locked — only one pending flag set
    expect(mutex.tryEnter()).toBe(false);
    expect(mutex.tryEnter()).toBe(false);
    expect(mutex.tryEnter()).toBe(false);

    // Exit with pending: lock released, returns true (schedule follow-up)
    expect(mutex.exit()).toBe(true);
    expect(mutex.isLocked).toBe(false);

    // No more pending — exit returns false
    expect(mutex.exit()).toBe(false);
  });

  it("releases lock when no pending follow-up", () => {
    const mutex = new TickMutex();
    mutex.tryEnter();
    expect(mutex.exit()).toBe(false);
    expect(mutex.isLocked).toBe(false);
  });

  it("allows re-entry after full release", () => {
    const mutex = new TickMutex();
    mutex.tryEnter();
    mutex.exit(); // no pending
    expect(mutex.tryEnter()).toBe(true);
    mutex.exit(); // no pending
    expect(mutex.isLocked).toBe(false);
  });

  it("pending flag is consumed by exit so only one follow-up fires", () => {
    const mutex = new TickMutex();
    mutex.tryEnter();

    // Multiple pending sets
    mutex.tryEnter();
    mutex.tryEnter();

    // First exit: pending consumed, returns true
    expect(mutex.exit()).toBe(true);

    // Second exit: no more pending, lock released
    expect(mutex.exit()).toBe(false);
    expect(mutex.isLocked).toBe(false);
  });

  it("isLocked reflects state accurately through the full lifecycle", () => {
    const mutex = new TickMutex();
    expect(mutex.isLocked).toBe(false);

    mutex.tryEnter();
    expect(mutex.isLocked).toBe(true);

    mutex.tryEnter(); // sets pending while locked
    expect(mutex.isLocked).toBe(true);

    mutex.exit(); // pending follow-up: lock released, returns true
    expect(mutex.isLocked).toBe(false);

    // Lock is fully free — can be re-acquired
    expect(mutex.tryEnter()).toBe(true);
    expect(mutex.isLocked).toBe(true);
    mutex.exit();
    expect(mutex.isLocked).toBe(false);
  });
});
