import { describe, expect, it, vi } from "vitest";
import { createMessageHandler } from "./messageHandler";
import type { DestinationOption, DownloadTask, Locale } from "../shared/types";

describe("createMessageHandler", () => {
  it("routes settings save and clears existing session", async () => {
    const deps = fakeDeps();
    const handle = createMessageHandler(deps);

    await expect(
      handle({
        type: "settings.save",
        settings: { baseUrl: "https://nas.local:5001", username: "user", password: "pass" }
      })
    ).resolves.toEqual({ ok: true, data: null });

    expect(deps.storage.saveSettings).toHaveBeenCalledOnce();
    expect(deps.storage.clearSession).toHaveBeenCalledOnce();
    expect(deps.storage.saveTaskCompletionStates).toHaveBeenCalledWith({});
  });

  it("routes task list responses", async () => {
    const deps = fakeDeps();
    deps.session.listTasks.mockResolvedValue([
      {
        id: "1",
        title: "file",
        status: "finished",
        progress: 100,
        downloadedBytes: 1,
        uploadedBytes: 0,
        totalBytes: 1,
        downloadSpeed: 0,
        uploadSpeed: 0
      }
    ]);
    const handle = createMessageHandler(deps);

    await expect(handle({ type: "tasks.list" })).resolves.toMatchObject({ ok: true, data: [{ title: "file" }] });
  });

  it("routes destination list responses", async () => {
    const deps = fakeDeps();
    deps.session.listDestinations.mockResolvedValue([{ value: "Download", label: "Download" }]);
    const handle = createMessageHandler(deps);

    await expect(handle({ type: "destinations.list" })).resolves.toEqual({
      ok: true,
      data: [{ value: "Download", label: "Download" }]
    });
  });

  it("routes task control requests", async () => {
    const deps = fakeDeps();
    const handle = createMessageHandler(deps);

    await expect(handle({ type: "tasks.pause", id: "dbid_1" })).resolves.toEqual({ ok: true, data: null });
    await expect(handle({ type: "tasks.resume", id: "dbid_1" })).resolves.toEqual({ ok: true, data: null });
    await expect(handle({ type: "tasks.delete", id: "dbid_1" })).resolves.toEqual({ ok: true, data: null });

    expect(deps.session.pauseTask).toHaveBeenCalledWith("dbid_1");
    expect(deps.session.resumeTask).toHaveBeenCalledWith("dbid_1");
    expect(deps.session.deleteTask).toHaveBeenCalledWith("dbid_1");
  });

  it("routes locale get and save through local storage", async () => {
    const deps = fakeDeps();
    deps.storage.getLocale.mockResolvedValue("zh");
    const handle = createMessageHandler(deps);

    await expect(handle({ type: "locale.get" })).resolves.toEqual({ ok: true, data: "zh" });
    await expect(handle({ type: "locale.save", locale: "en" })).resolves.toEqual({ ok: true, data: null });
    expect(deps.storage.saveLocale).toHaveBeenCalledWith("en");
  });

  it("returns normalized errors for invalid requests", async () => {
    const handle = createMessageHandler(fakeDeps());

    await expect(handle({ type: "unknown" })).resolves.toEqual({
      ok: false,
      error: { code: "invalid_request", message: "Unsupported request.", retryable: false }
    });
  });
});

function fakeDeps() {
  return {
    storage: {
      getSettings: vi.fn(async () => null),
      saveSettings: vi.fn(async () => undefined),
      getSession: vi.fn(async () => null),
      saveSession: vi.fn(async () => undefined),
      clearSession: vi.fn(async () => undefined),
      getLocale: vi.fn(async (): Promise<Locale | null> => null),
      saveLocale: vi.fn(async () => undefined),
      getTaskCompletionStates: vi.fn(async () => ({})),
      saveTaskCompletionStates: vi.fn(async () => undefined)
    },
    session: {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      listTasks: vi.fn(async (): Promise<DownloadTask[]> => []),
      listDestinations: vi.fn(async (): Promise<DestinationOption[]> => []),
      pauseTask: vi.fn(async () => undefined),
      resumeTask: vi.fn(async () => undefined),
      deleteTask: vi.fn(async () => undefined),
      createDownload: vi.fn(async () => ({ created: 1 }))
    }
  };
}
