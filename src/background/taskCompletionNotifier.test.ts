import { describe, expect, it, vi } from "vitest";
import { createTaskCompletionNotifier } from "./taskCompletionNotifier";
import type { SessionManager } from "./sessionManager";
import type { StorageAdapter } from "./storage";
import type { DownloadTask } from "../shared/types";

describe("createTaskCompletionNotifier", () => {
  it("records the first task snapshot without notifying for already finished tasks", async () => {
    const storage = fakeStorage({});
    const session = fakeSession([
      task({ id: "1", title: "old.iso", status: "finished" }),
      task({ id: "2", title: "active.iso", status: "downloading" })
    ]);
    const notifications = fakeNotifications();
    const notifier = createTaskCompletionNotifier({ storage, session, notifications });

    await notifier.check();

    expect(notifications.create).not.toHaveBeenCalled();
    expect(storage.saveTaskCompletionStates).toHaveBeenCalledWith({
      "1": "finished",
      "2": "downloading"
    });
  });

  it("notifies when a known task changes to finished", async () => {
    const storage = fakeStorage({ "1": "downloading" });
    const session = fakeSession([task({ id: "1", title: "ubuntu.iso", status: "finished" })]);
    const notifications = fakeNotifications();
    const notifier = createTaskCompletionNotifier({ storage, session, notifications });

    await notifier.check();

    expect(notifications.create).toHaveBeenCalledWith(
      expect.stringContaining("download-complete-1"),
      expect.objectContaining({
        type: "basic",
        iconUrl: "icons/icon-128.png",
        title: "Download complete",
        message: "ubuntu.iso"
      })
    );
    expect(storage.saveTaskCompletionStates).toHaveBeenCalledWith({ "1": "finished" });
  });

  it("does not notify repeatedly for tasks that were already marked finished", async () => {
    const storage = fakeStorage({ "1": "finished" });
    const session = fakeSession([task({ id: "1", title: "ubuntu.iso", status: "finished" })]);
    const notifications = fakeNotifications();
    const notifier = createTaskCompletionNotifier({ storage, session, notifications });

    await notifier.check();

    expect(notifications.create).not.toHaveBeenCalled();
  });
});

function fakeStorage(states: Record<string, DownloadTask["status"]>): StorageAdapter {
  return {
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
    getSession: vi.fn(),
    saveSession: vi.fn(),
    clearSession: vi.fn(),
    getLocale: vi.fn(),
    saveLocale: vi.fn(),
    getTaskCompletionStates: vi.fn(async () => states),
    saveTaskCompletionStates: vi.fn()
  };
}

function fakeSession(tasks: DownloadTask[]): SessionManager {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    listTasks: vi.fn(async () => tasks),
    listDestinations: vi.fn(),
    createDownload: vi.fn(),
    pauseTask: vi.fn(),
    resumeTask: vi.fn(),
    deleteTask: vi.fn()
  };
}

function fakeNotifications() {
  return {
    create: vi.fn(async () => "notification-id")
  };
}

function task(overrides: Pick<DownloadTask, "id" | "title" | "status">): DownloadTask {
  return {
    progress: overrides.status === "finished" ? 100 : 50,
    downloadedBytes: 0,
    uploadedBytes: 0,
    totalBytes: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
    ...overrides
  };
}
