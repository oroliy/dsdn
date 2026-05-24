import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStorageAdapter, type StorageRoot } from "./storage";

const localState = new Map<string, unknown>();
const sessionState = new Map<string, unknown>();

beforeEach(() => {
  localState.clear();
  sessionState.clear();
});

describe("createStorageAdapter", () => {
  it("saves and loads settings from local storage", async () => {
    const storage = createStorageAdapter(fakeChromeStorage());

    await storage.saveSettings({
      baseUrl: "https://nas.local:5001",
      username: "user",
      password: "pass"
    });

    await expect(storage.getSettings()).resolves.toEqual({
      baseUrl: "https://nas.local:5001",
      username: "user",
      password: "pass"
    });
  });

  it("stores session in session storage and clears it", async () => {
    const storage = createStorageAdapter(fakeChromeStorage());

    await storage.saveSession({ sid: "abc", createdAt: 123 });
    await expect(storage.getSession()).resolves.toEqual({ sid: "abc", createdAt: 123 });

    await storage.clearSession();
    await expect(storage.getSession()).resolves.toBeNull();
  });

  it("saves and loads locale from local storage", async () => {
    const storage = createStorageAdapter(fakeChromeStorage());

    await storage.saveLocale("zh");

    await expect(storage.getLocale()).resolves.toBe("zh");
  });

  it("saves and loads task completion states from local storage", async () => {
    const storage = createStorageAdapter(fakeChromeStorage());

    await storage.saveTaskCompletionStates({ task_1: "downloading", task_2: "finished" });

    await expect(storage.getTaskCompletionStates()).resolves.toEqual({ task_1: "downloading", task_2: "finished" });
  });
});

function fakeChromeStorage(): StorageRoot {
  return {
    local: area(localState),
    session: area(sessionState)
  };
}

function area(state: Map<string, unknown>) {
  return {
    get: vi.fn(async (key: string) => ({ [key]: state.get(key) })),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.entries(items).forEach(([key, value]) => state.set(key, value));
    }),
    remove: vi.fn(async (key: string) => {
      state.delete(key);
    })
  };
}
