import type { ExtensionRequest, ExtensionResponse, ExtensionResponseMap } from "../shared/messages";
import { debugLog } from "../shared/debug";

export async function sendMessage<T extends ExtensionRequest["type"]>(
  request: Extract<ExtensionRequest, { type: T }>
): Promise<ExtensionResponse<ExtensionResponseMap[T]>> {
  debugLog("popup", "send message", request);
  const response = await chrome.runtime.sendMessage(request);
  debugLog("popup", "received response", { type: request.type, ok: response?.ok });
  return response;
}
