import type { ExtensionRequest, ExtensionResponse, ExtensionResponseMap } from "../shared/messages";
import { debugLog } from "../shared/debug";
import { summarizeTasksForDebug } from "../shared/taskDebug";
import type { DownloadTask } from "../shared/types";

export async function sendMessage<T extends ExtensionRequest["type"]>(
  request: Extract<ExtensionRequest, { type: T }>
): Promise<ExtensionResponse<ExtensionResponseMap[T]>> {
  debugLog("popup", "send message", request);
  const response = await chrome.runtime.sendMessage(request);
  debugLog("popup", "received response", { type: request.type, ok: response?.ok });
  if (request.type === "tasks.list" && response?.ok && Array.isArray(response.data)) {
    debugLog("popup", "received task list", summarizeTasksForDebug(response.data as DownloadTask[]));
  }
  return response;
}
