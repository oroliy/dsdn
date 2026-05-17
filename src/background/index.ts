import { createMessageHandler } from "./messageHandler";
import { createDownloadLinkContextMenu, registerDownloadLinkContextMenu } from "./linkContextMenu";
import { createSessionManager } from "./sessionManager";
import { createStorageAdapter } from "./storage";
import { createSynologyClient } from "./synologyClient";

const storage = createStorageAdapter(chrome.storage);
const session = createSessionManager({
  storage,
  clientFactory: (baseUrl) => createSynologyClient(baseUrl)
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

function isLocaleSaveRequest(request: unknown): request is { type: "locale.save" } {
  return Boolean(request && typeof request === "object" && "type" in request && request.type === "locale.save");
}
