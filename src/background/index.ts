import { createMessageHandler } from "./messageHandler";
import { createSessionManager } from "./sessionManager";
import { createStorageAdapter } from "./storage";
import { createSynologyClient } from "./synologyClient";

const storage = createStorageAdapter(chrome.storage);
const session = createSessionManager({
  storage,
  clientFactory: (baseUrl) => createSynologyClient(baseUrl)
});
const handleMessage = createMessageHandler({ storage, session });

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  handleMessage(request).then(sendResponse);
  return true;
});
