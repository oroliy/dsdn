import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADD_TO_DOWNLOAD_STATION_MENU_ID,
  createDownloadLinkContextMenu,
  handleDownloadLinkContextMenuClick,
  registerDownloadLinkContextMenu
} from "./linkContextMenu";

type FakeChrome = Pick<typeof chrome, "contextMenus" | "runtime" | "tabs" | "windows">;

function createFakeChrome(): FakeChrome {
  const fakeRuntime = {
    getURL: vi.fn((path: string) => `chrome-extension://extension-id/${path}`),
    onInstalled: {
      addListener: vi.fn()
    }
  } as unknown as typeof chrome.runtime;

  return {
    contextMenus: {
      create: vi.fn((_properties, callback?: () => void) => callback?.()),
      removeAll: vi.fn((callback?: () => void) => callback?.()),
      onClicked: {
        addListener: vi.fn()
      }
    } as unknown as typeof chrome.contextMenus,
    runtime: fakeRuntime,
    tabs: {
      create: vi.fn((_properties, callback?: () => void) => callback?.())
    } as unknown as typeof chrome.tabs,
    windows: {
      create: vi.fn((_properties, callback?: () => void) => callback?.())
    } as unknown as typeof chrome.windows
  };
}

describe("link context menu", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("registers a link-only context menu on install and click handler immediately", () => {
    const chromeApi = createFakeChrome();

    registerDownloadLinkContextMenu(chromeApi);

    expect(chromeApi.runtime.onInstalled.addListener).toHaveBeenCalledTimes(1);
    expect(chromeApi.contextMenus.onClicked.addListener).toHaveBeenCalledTimes(1);
  });

  it("creates the add-to-download-station menu item for links", () => {
    const chromeApi = createFakeChrome();

    createDownloadLinkContextMenu(chromeApi);

    expect(chromeApi.contextMenus.removeAll).toHaveBeenCalledTimes(1);
    expect(chromeApi.contextMenus.create).toHaveBeenCalledWith(
      {
        id: ADD_TO_DOWNLOAD_STATION_MENU_ID,
        title: "Add to Download Station / 添加到 Download Station",
        contexts: ["link"]
      },
      expect.any(Function)
    );
  });

  it("opens the add download page in a popup window for supported links", async () => {
    const chromeApi = createFakeChrome();
    const linkUrl = "https://example.com/file.iso";

    await handleDownloadLinkContextMenuClick(
      { menuItemId: ADD_TO_DOWNLOAD_STATION_MENU_ID, linkUrl } as chrome.contextMenus.OnClickData,
      chromeApi
    );

    const expectedUrl = `chrome-extension://extension-id/index.html?${new URLSearchParams({ view: "add", uri: linkUrl }).toString()}`;
    expect(chromeApi.windows.create).toHaveBeenCalledWith(
      {
        url: expectedUrl,
        type: "popup",
        width: 420,
        height: 720,
        focused: true
      },
      expect.any(Function)
    );
    expect(chromeApi.tabs.create).not.toHaveBeenCalled();
  });

  it("falls back to a tab when the popup window cannot be opened", async () => {
    const chromeApi = createFakeChrome();
    const linkUrl = "magnet:?xt=urn:btih:test";
    chromeApi.windows.create = vi.fn((_properties, callback?: () => void) => {
      chromeApi.runtime.lastError = { message: "Window blocked" } as chrome.runtime.LastError;
      callback?.();
      delete chromeApi.runtime.lastError;
    }) as unknown as typeof chrome.windows.create;

    await handleDownloadLinkContextMenuClick(
      { menuItemId: ADD_TO_DOWNLOAD_STATION_MENU_ID, linkUrl } as chrome.contextMenus.OnClickData,
      chromeApi
    );

    const expectedUrl = `chrome-extension://extension-id/index.html?${new URLSearchParams({ view: "add", uri: linkUrl }).toString()}`;
    expect(chromeApi.tabs.create).toHaveBeenCalledWith({ url: expectedUrl, active: true }, expect.any(Function));
  });

  it("ignores unsupported links", async () => {
    const chromeApi = createFakeChrome();

    await handleDownloadLinkContextMenuClick(
      { menuItemId: ADD_TO_DOWNLOAD_STATION_MENU_ID, linkUrl: "javascript:alert(1)" } as chrome.contextMenus.OnClickData,
      chromeApi
    );

    expect(chromeApi.windows.create).not.toHaveBeenCalled();
    expect(chromeApi.tabs.create).not.toHaveBeenCalled();
  });
});
