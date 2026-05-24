import { createMessageHandler } from "./messageHandler";
import { createDownloadLinkContextMenu, registerDownloadLinkContextMenu } from "./linkContextMenu";
import { createSessionManager } from "./sessionManager";
import { createStorageAdapter } from "./storage";
import { createSynologyClient } from "./synologyClient";
import { createTaskCompletionNotifier } from "./taskCompletionNotifier";

const TASK_COMPLETION_ALARM = "task-completion-check";
const TASK_COMPLETION_CHECK_PERIOD_MINUTES = 1;

const storage = createStorageAdapter(chrome.storage);
const session = createSessionManager({
  storage,
  clientFactory: (baseUrl) => createSynologyClient(baseUrl)
});
const completionNotifier = createTaskCompletionNotifier({
  storage,
  session,
  notifications: {
    create: (id, options) =>
      new Promise((resolve) => {
        chrome.notifications.create(id, options, (notificationId) => resolve(notificationId));
      })
  }
});
const handleMessage = createMessageHandler({ storage, session });
const contextMenuDeps = {
  getLocale: () => storage.getLocale()
};

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  handleMessage(request).then((response) => {
    sendResponse(response);
    if (response.ok && isLocaleSaveRequest(request)) {
      void createDownloadLinkContextMenu(chrome, contextMenuDeps);
    }
  });
  return true;
});

registerDownloadLinkContextMenu(chrome, contextMenuDeps);
scheduleTaskCompletionChecks();

chrome.runtime.onStartup.addListener(scheduleTaskCompletionChecks);
chrome.runtime.onInstalled.addListener(scheduleTaskCompletionChecks);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TASK_COMPLETION_ALARM) {
    void completionNotifier.check().catch((error) => {
      console.warn("[Synology Download Station] Task completion check failed.", error);
    });
  }
});

function isLocaleSaveRequest(request: unknown): request is { type: "locale.save" } {
  return Boolean(request && typeof request === "object" && "type" in request && request.type === "locale.save");
}

function scheduleTaskCompletionChecks() {
  chrome.alarms.create(TASK_COMPLETION_ALARM, { periodInMinutes: TASK_COMPLETION_CHECK_PERIOD_MINUTES });
}
