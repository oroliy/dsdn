import type { SessionManager } from "./sessionManager";
import type { StorageAdapter, TaskCompletionStates } from "./storage";
import { debugLog } from "../shared/debug";
import type { DownloadTask } from "../shared/types";

const NOTIFICATION_ICON = "icons/icon-128.png";

type NotificationApi = {
  create(id: string, options: chrome.notifications.NotificationOptions<true>): Promise<string>;
};

export function createTaskCompletionNotifier(deps: { storage: StorageAdapter; session: SessionManager; notifications: NotificationApi }) {
  async function check(): Promise<void> {
    const previousStates = await deps.storage.getTaskCompletionStates();
    const tasks = await deps.session.listTasks();
    const nextStates = statesFromTasks(tasks);
    const completedTasks = tasks.filter((task) => shouldNotifyCompletion(task, previousStates));

    for (const task of completedTasks) {
      await deps.notifications.create(notificationId(task), {
        type: "basic",
        iconUrl: NOTIFICATION_ICON,
        title: "Download complete",
        message: task.title
      });
    }

    await deps.storage.saveTaskCompletionStates(nextStates);
    if (completedTasks.length > 0) {
      debugLog("background", "sent completion notifications", {
        count: completedTasks.length,
        tasks: completedTasks.map((task) => ({ id: task.id, title: task.title }))
      });
    }
  }

  return { check };
}

function shouldNotifyCompletion(task: DownloadTask, previousStates: TaskCompletionStates): boolean {
  const previousStatus = previousStates[task.id];
  return Boolean(previousStatus && previousStatus !== "finished" && task.status === "finished");
}

function statesFromTasks(tasks: DownloadTask[]): TaskCompletionStates {
  return Object.fromEntries(tasks.map((task) => [task.id, task.status]));
}

function notificationId(task: DownloadTask): string {
  return `download-complete-${task.id}-${task.completedAt ?? Date.now()}`;
}
