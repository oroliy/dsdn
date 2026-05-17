import { debugLog } from "../shared/debug";
import { buildAddDownloadPagePath, isSupportedDownloadUri } from "../shared/downloadUris";

export const ADD_TO_DOWNLOAD_STATION_MENU_ID = "add-to-download-station";

type LinkContextMenuChrome = Pick<typeof chrome, "contextMenus" | "runtime" | "tabs" | "windows">;

const MENU_TITLE = "Add to Download Station / 添加到 Download Station";
const POPUP_WIDTH = 420;
const POPUP_HEIGHT = 720;

export function registerDownloadLinkContextMenu(chromeApi: LinkContextMenuChrome): void {
  chromeApi.runtime.onInstalled.addListener(() => createDownloadLinkContextMenu(chromeApi));
  chromeApi.contextMenus.onClicked.addListener((info) => {
    void handleDownloadLinkContextMenuClick(info, chromeApi);
  });
  debugLog("browser downloader", "context menu handlers registered", {
    menuId: ADD_TO_DOWNLOAD_STATION_MENU_ID,
    contexts: ["link"]
  });
}

export function createDownloadLinkContextMenu(chromeApi: LinkContextMenuChrome): void {
  chromeApi.contextMenus.removeAll(() => {
    chromeApi.contextMenus.create(
      {
        id: ADD_TO_DOWNLOAD_STATION_MENU_ID,
        title: MENU_TITLE,
        contexts: ["link"]
      },
      () => {
        const errorMessage = chromeApi.runtime.lastError?.message;
        if (errorMessage) {
          debugLog("browser downloader", "context menu unavailable", {
            menuId: ADD_TO_DOWNLOAD_STATION_MENU_ID,
            message: errorMessage
          });
          return;
        }
        debugLog("browser downloader", "context menu ready", {
          menuId: ADD_TO_DOWNLOAD_STATION_MENU_ID,
          title: MENU_TITLE,
          contexts: ["link"]
        });
      }
    );
  });
}

export async function handleDownloadLinkContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  chromeApi: LinkContextMenuChrome
): Promise<void> {
  if (info.menuItemId !== ADD_TO_DOWNLOAD_STATION_MENU_ID) return;

  const linkUrl = typeof info.linkUrl === "string" ? info.linkUrl.trim() : "";
  debugLog("browser downloader", "link selected from context menu", { linkUrl });

  if (!isSupportedDownloadUri(linkUrl)) {
    debugLog("browser downloader", "unsupported link ignored", {
      linkUrl: linkUrl || "(empty)",
      supportedSchemes: ["http:", "https:", "ftp:", "magnet:?"]
    });
    return;
  }

  const extensionUrl = chromeApi.runtime.getURL(buildAddDownloadPagePath(linkUrl));
  const openedInWindow = await openAddDownloadWindow(chromeApi, extensionUrl);
  if (openedInWindow) {
    debugLog("browser downloader", "opened add download popup window", { url: extensionUrl });
    return;
  }

  await openAddDownloadTab(chromeApi, extensionUrl);
  debugLog("browser downloader", "opened add download fallback tab", { url: extensionUrl });
}

async function openAddDownloadWindow(chromeApi: LinkContextMenuChrome, url: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chromeApi.windows.create(
        {
          url,
          type: "popup",
          width: POPUP_WIDTH,
          height: POPUP_HEIGHT,
          focused: true
        },
        () => {
          const errorMessage = chromeApi.runtime.lastError?.message;
          if (errorMessage) {
            debugLog("browser downloader", "popup window unavailable", { message: errorMessage });
            resolve(false);
            return;
          }
          resolve(true);
        }
      );
    } catch (error) {
      debugLog("browser downloader", "popup window failed", { message: error instanceof Error ? error.message : String(error) });
      resolve(false);
    }
  });
}

async function openAddDownloadTab(chromeApi: LinkContextMenuChrome, url: string): Promise<void> {
  return new Promise((resolve) => {
    chromeApi.tabs.create({ url, active: true }, () => {
      const errorMessage = chromeApi.runtime.lastError?.message;
      if (errorMessage) {
        debugLog("browser downloader", "fallback tab failed", { message: errorMessage });
      }
      resolve();
    });
  });
}
