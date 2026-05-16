import { vi } from "vitest";

export function createDeepMock(): any {
  const fn = vi.fn();
  return new Proxy(fn, {
    get(target, prop, receiver) {
      if (prop === "then") {
        return undefined;
      }
      if (prop in target) {
        return Reflect.get(target, prop, receiver);
      }
      const mock = createDeepMock();
      (target as any)[prop] = mock;
      return mock;
    },
  });
}

export type MockDb = ReturnType<typeof createDeepMock>;

export function createMockDb(): MockDb {
  return createDeepMock();
}
