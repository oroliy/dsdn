import { debugLog } from "../shared/debug";
import { buildAddDownloadPagePath, isSupportedDownloadUri } from "../shared/downloadUris";
import type { Locale } from "../shared/types";

export const ADD_TO_DOWNLOAD_STATION_MENU_ID = "add-to-download-station";

type LinkContextMenuChrome = Pick<typeof chrome, "action" | "contextMenus" | "runtime" | "tabs" | "windows">;
export type LinkContextMenuDeps = {
  getLocale: () => Promise<Locale | null>;
};

const POPUP_WIDTH = 420;
const POPUP_HEIGHT = 720;
const DEFAULT_POPUP_PATH = "index.html";

export function registerDownloadLinkContextMenu(chromeApi: LinkContextMenuChrome, deps: LinkContextMenuDeps): void {
  chromeApi.runtime.onInstalled.addListener(() => {
    void createDownloadLinkContextMenu(chromeApi, deps);
  });
  chromeApi.contextMenus.onClicked.addListener((info) => {
    void handleDownloadLinkContextMenuClick(info, chromeApi);
  });
  void createDownloadLinkContextMenu(chromeApi, deps);
  debugLog("browser downloader", "context menu handlers registered", {
    menuId: ADD_TO_DOWNLOAD_STATION_MENU_ID,
    contexts: ["link"]
  });
}

export async function createDownloadLinkContextMenu(chromeApi: LinkContextMenuChrome, deps: LinkContextMenuDeps): Promise<void> {
  const locale = (await deps.getLocale()) ?? "en";
  const title = getMenuTitle(locale);

  return new Promise((resolve) => {
    chromeApi.contextMenus.removeAll(() => {
      chromeApi.contextMenus.create(
        {
          id: ADD_TO_DOWNLOAD_STATION_MENU_ID,
          title,
          contexts: ["link"]
        },
        () => {
          const errorMessage = chromeApi.runtime.lastError?.message;
          if (errorMessage) {
            debugLog("browser downloader", "context menu unavailable", {
              menuId: ADD_TO_DOWNLOAD_STATION_MENU_ID,
              message: errorMessage
            });
            resolve();
            return;
          }
          debugLog("browser downloader", "context menu ready", {
            menuId: ADD_TO_DOWNLOAD_STATION_MENU_ID,
            title,
            contexts: ["link"]
          });
          resolve();
        }
      );
    });
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

  const popupPath = buildAddDownloadPagePath(linkUrl);
  const openedInActionPopup = await openAddDownloadActionPopup(chromeApi, popupPath);
  if (openedInActionPopup) {
    debugLog("browser downloader", "opened add download action popup", { popup: popupPath });
    return;
  }

  const extensionUrl = chromeApi.runtime.getURL(popupPath);
  await openAddDownloadWindow(chromeApi, extensionUrl);
  debugLog("browser downloader", "opened add download fallback window", { url: extensionUrl });
}

async function openAddDownloadActionPopup(chromeApi: LinkContextMenuChrome, popupPath: string): Promise<boolean> {
  try {
    await chromeApi.action.setPopup({ popup: popupPath });
    await chromeApi.action.openPopup();
    return true;
  } catch (error) {
    debugLog("browser downloader", "action popup unavailable", { message: error instanceof Error ? error.message : String(error) });
    return false;
  } finally {
    try {
      await chromeApi.action.setPopup({ popup: DEFAULT_POPUP_PATH });
    } catch (error) {
      debugLog("browser downloader", "default popup restore failed", { message: error instanceof Error ? error.message : String(error) });
    }
  }
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

function getMenuTitle(locale: Locale): string {
  return locale === "zh" ? "添加到 Download Station" : "Add to Download Station";
}
