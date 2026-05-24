import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADD_TO_DOWNLOAD_STATION_MENU_ID,
  createDownloadLinkContextMenu,
  handleDownloadLinkContextMenuClick,
  registerDownloadLinkContextMenu
} from "./linkContextMenu";

type FakeChrome = Pick<typeof chrome, "action" | "contextMenus" | "runtime" | "tabs" | "windows">;

function createFakeChrome(): FakeChrome {
  const fakeRuntime = {
    getURL: vi.fn((path: string) => `chrome-extension://extension-id/${path}`),
    onInstalled: {
      addListener: vi.fn()
    }
  } as unknown as typeof chrome.runtime;

  return {
    action: {
      openPopup: vi.fn(async () => undefined),
      setPopup: vi.fn(async () => undefined)
    } as unknown as typeof chrome.action,
    contextMenus: {
      create: vi.fn((_properties, callback?: () => void) => callback?.()),
      removeAll: vi.fn((callback?: () => void) => callback?.()),
      update: vi.fn((_id, _properties, callback?: () => void) => callback?.()),
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
  } as FakeChrome;
}

function fakeDeps(locale: "en" | "zh" | null = "en") {
  return {
    getLocale: vi.fn(async () => locale)
  };
}

describe("link context menu", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("registers a link-only context menu on install and click handler immediately", () => {
    const chromeApi = createFakeChrome();

    registerDownloadLinkContextMenu(chromeApi, fakeDeps());

    expect(chromeApi.runtime.onInstalled.addListener).toHaveBeenCalledTimes(1);
    expect(chromeApi.contextMenus.onClicked.addListener).toHaveBeenCalledTimes(1);
  });

  it("creates the add-to-download-station menu item for native link targets", async () => {
    const chromeApi = createFakeChrome();

    await createDownloadLinkContextMenu(chromeApi, fakeDeps("en"));

    expect(chromeApi.contextMenus.removeAll).toHaveBeenCalledTimes(1);
    expect(chromeApi.contextMenus.create).toHaveBeenCalledWith(
      {
        id: ADD_TO_DOWNLOAD_STATION_MENU_ID,
        title: "Add to Download Station",
        contexts: ["link"]
      },
      expect.any(Function)
    );
  });

  it("uses the configured locale for the menu title", async () => {
    const chromeApi = createFakeChrome();

    await createDownloadLinkContextMenu(chromeApi, fakeDeps("zh"));

    expect(chromeApi.contextMenus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "添加到 Download Station"
      }),
      expect.any(Function)
    );
  });

  it("opens the add download page through the extension action popup for supported links", async () => {
    const chromeApi = createFakeChrome();
    const linkUrl = "https://example.com/file.iso";

    await handleDownloadLinkContextMenuClick(
      { menuItemId: ADD_TO_DOWNLOAD_STATION_MENU_ID, linkUrl } as chrome.contextMenus.OnClickData,
      chromeApi
    );

    const expectedPopup = `index.html?${new URLSearchParams({ view: "add", uri: linkUrl }).toString()}`;
    expect(chromeApi.action.setPopup).toHaveBeenNthCalledWith(1, { popup: expectedPopup });
    expect(chromeApi.action.openPopup).toHaveBeenCalledOnce();
    expect(chromeApi.action.setPopup).toHaveBeenNthCalledWith(2, { popup: "index.html" });
    expect(chromeApi.windows.create).not.toHaveBeenCalled();
    expect(chromeApi.tabs.create).not.toHaveBeenCalled();
  });

  it("opens magnet links through the extension action popup when Chrome provides linkUrl", async () => {
    const chromeApi = createFakeChrome();
    const linkUrl = "magnet:?xt=urn:btih:test";

    await handleDownloadLinkContextMenuClick(
      { menuItemId: ADD_TO_DOWNLOAD_STATION_MENU_ID, linkUrl } as chrome.contextMenus.OnClickData,
      chromeApi
    );

    const expectedPopup = `index.html?${new URLSearchParams({ view: "add", uri: linkUrl }).toString()}`;
    expect(chromeApi.action.setPopup).toHaveBeenNthCalledWith(1, { popup: expectedPopup });
    expect(chromeApi.action.openPopup).toHaveBeenCalledOnce();
    expect(chromeApi.windows.create).not.toHaveBeenCalled();
  });

  it("ignores clicks when Chrome does not provide a supported linkUrl", async () => {
    const chromeApi = createFakeChrome();

    await handleDownloadLinkContextMenuClick({ menuItemId: ADD_TO_DOWNLOAD_STATION_MENU_ID } as chrome.contextMenus.OnClickData, chromeApi);

    expect(chromeApi.action.openPopup).not.toHaveBeenCalled();
    expect(chromeApi.windows.create).not.toHaveBeenCalled();
  });

  it("falls back to a popup window when the action popup cannot be opened", async () => {
    const chromeApi = createFakeChrome();
    const linkUrl = "magnet:?xt=urn:btih:test";
    chromeApi.action.openPopup = vi.fn(async () => {
      throw new Error("Popup blocked");
    }) as unknown as typeof chrome.action.openPopup;

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
