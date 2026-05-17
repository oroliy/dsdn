import { describe, expect, it, vi } from "vitest";
import { AppError } from "./errors";
import { createSessionManager } from "./sessionManager";
import type { StorageAdapter } from "./storage";

const settings = { baseUrl: "https://nas.local:5001", username: "user", password: "pass" };

describe("createSessionManager", () => {
  it("reuses an existing session for task listing", async () => {
    const client = fakeClient();
    const storage = fakeStorage({ sid: "SID123", createdAt: 1 });
    const session = createSessionManager({ storage, clientFactory: () => client });

    await session.listTasks();

    expect(client.login).not.toHaveBeenCalled();
    expect(client.listTasks).toHaveBeenCalledWith("SID123");
  });

  it("logs in when no session exists", async () => {
    const client = fakeClient();
    const storage = fakeStorage(null);
    const session = createSessionManager({ storage, clientFactory: () => client, now: () => 10 });

    await session.listTasks();

    expect(client.login).toHaveBeenCalledWith("user", "pass");
    expect(storage.saveSession).toHaveBeenCalledWith({ sid: "SID_NEW", createdAt: 10 });
  });

  it("clears expired session, logs in once, and retries", async () => {
    const client = fakeClient();
    client.listTasks = vi
      .fn()
      .mockRejectedValueOnce(new AppError({ code: "105", message: "expired", retryable: true }))
      .mockResolvedValueOnce([]);
    const storage = fakeStorage({ sid: "OLD", createdAt: 1 });
    const session = createSessionManager({ storage, clientFactory: () => client });

    await session.listTasks();

    expect(storage.clearSession).toHaveBeenCalledOnce();
    expect(client.login).toHaveBeenCalledOnce();
    expect(client.listTasks).toHaveBeenNthCalledWith(2, "SID_NEW");
  });

  it("surfaces failed login as an api error", async () => {
    const client = fakeClient();
    client.login = vi.fn().mockRejectedValue(new AppError({ code: "auth_failed", message: "Login failed.", retryable: false }));
    const session = createSessionManager({ storage: fakeStorage(null), clientFactory: () => client });

    await expect(session.listTasks()).rejects.toMatchObject({ apiError: { code: "auth_failed" } });
  });

  it("lists destinations through the current session", async () => {
    const client = fakeClient();
    const storage = fakeStorage({ sid: "SID123", createdAt: 1 });
    const session = createSessionManager({ storage, clientFactory: () => client });

    await session.listDestinations();

    expect(client.listDestinations).toHaveBeenCalledWith("SID123", "user", "pass");
  });
});

function fakeClient() {
  return {
    login: vi.fn(async () => ({ sid: "SID_NEW", createdAt: 2 })),
    logout: vi.fn(async () => undefined),
    listTasks: vi.fn(async () => []),
    listDestinations: vi.fn(async () => [{ value: "Download", label: "Download" }]),
    createDownload: vi.fn(async () => ({ created: 1 }))
  };
}

function fakeStorage(initialSession: { sid: string; createdAt: number } | null): StorageAdapter {
  let currentSession = initialSession;
  return {
    getSettings: vi.fn(async () => settings),
    saveSettings: vi.fn(async () => undefined),
    getSession: vi.fn(async () => currentSession),
    saveSession: vi.fn(async (session) => {
      currentSession = session;
    }),
    clearSession: vi.fn(async () => {
      currentSession = null;
    })
  };
}
