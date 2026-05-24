import { AppError, asApiError } from "./errors";
import type { SessionManager } from "./sessionManager";
import type { StorageAdapter } from "./storage";
import { debugLog } from "../shared/debug";
import { fail, isExtensionRequest, ok } from "../shared/messages";

export function createMessageHandler(deps: { storage: StorageAdapter; session: SessionManager }) {
  return async function handleMessage(request: unknown) {
    try {
      debugLog("background", "received message", request);
      if (!isExtensionRequest(request)) {
        throw new AppError({ code: "invalid_request", message: "Unsupported request.", retryable: false });
      }

      switch (request.type) {
        case "locale.get":
          return ok(await deps.storage.getLocale());
        case "locale.save":
          await deps.storage.saveLocale(request.locale);
          return ok(null);
        case "settings.get":
          return ok(await deps.storage.getSettings());
        case "settings.save":
          await deps.storage.saveSettings(request.settings);
          await deps.storage.clearSession();
          await deps.storage.saveTaskCompletionStates({});
          return ok(null);
        case "session.connect":
          await deps.session.connect();
          return ok(null);
        case "session.disconnect":
          await deps.session.disconnect();
          return ok(null);
        case "tasks.list":
          return ok(await deps.session.listTasks());
        case "tasks.pause":
          await deps.session.pauseTask(request.id);
          return ok(null);
        case "tasks.resume":
          await deps.session.resumeTask(request.id);
          return ok(null);
        case "tasks.delete":
          await deps.session.deleteTask(request.id);
          return ok(null);
        case "destinations.list":
          return ok(await deps.session.listDestinations());
        case "downloads.create":
          return ok(await deps.session.createDownload(request.uris, request.destination));
      }
    } catch (error) {
      debugLog("background", "message failed", asApiError(error));
      return fail(asApiError(error));
    }
  };
}
