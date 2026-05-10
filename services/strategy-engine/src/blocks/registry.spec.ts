import { describe, it, expect } from "vitest";
import {
  SAFETY_REGISTRY,
  TRIGGER_REGISTRY,
  CONDITION_REGISTRY,
  ACTION_REGISTRY,
  LOGIC_REGISTRY,
  CALC_REGISTRY,
} from "./registry";

describe("Registry collision safety", () => {
  it("no evaluator key is registered in more than one registry", () => {
    const registries: Record<string, unknown>[] = [
      SAFETY_REGISTRY,
      TRIGGER_REGISTRY,
      CONDITION_REGISTRY,
      ACTION_REGISTRY,
      LOGIC_REGISTRY,
      CALC_REGISTRY,
    ];
    const registryNames = [
      "SAFETY_REGISTRY",
      "TRIGGER_REGISTRY",
      "CONDITION_REGISTRY",
      "ACTION_REGISTRY",
      "LOGIC_REGISTRY",
      "CALC_REGISTRY",
    ];

    const keyToRegistries = new Map<string, string[]>();

    for (let i = 0; i < registries.length; i++) {
      for (const key of Object.keys(registries[i])) {
        const existing = keyToRegistries.get(key);
        if (existing) {
          existing.push(registryNames[i]);
        } else {
          keyToRegistries.set(key, [registryNames[i]]);
        }
      }
    }

    const collisions: { key: string; registries: string[] }[] = [];
    for (const [key, regs] of keyToRegistries) {
      if (regs.length > 1) {
        collisions.push({ key, registries: regs });
      }
    }

    // DAILY_LOSS_LIMIT is a pre-existing collision (SAFETY + CONDITION)
    // tracked as incidental:polyforge:daily-loss-limit-registry-collision
    // MAX_POSITION_SIZE is an intentional legacy alias in SAFETY_REGISTRY
    // (backward compat) while the canonical entry is in CONDITION_REGISTRY
    const knownCollisions = new Set(["DAILY_LOSS_LIMIT", "MAX_POSITION_SIZE"]);
    const unexpected = collisions.filter(
      (c) => !knownCollisions.has(c.key),
    );

    expect(unexpected).toHaveLength(0);
  });
});
