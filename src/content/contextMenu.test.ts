import { describe, expect, it, beforeEach, vi } from "vitest";

const sendMessage = vi.fn();
const log = vi.fn();

describe("content context menu reporter", () => {
  beforeEach(() => {
    vi.resetModules();
    sendMessage.mockReset();
    log.mockReset();
    vi.spyOn(console, "log").mockImplementation(log);
    Object.defineProperty(globalThis, "chrome", {
      value: {
        runtime: {
          sendMessage
        }
      },
      configurable: true
    });
  });

  it("logs when the content script is ready", async () => {
    // @ts-expect-error contextMenu.ts is intentionally a classic script for Chrome content script loading.
    await import("./contextMenu");

    expect(log).toHaveBeenCalledWith(expect.stringContaining("Browser Downloader Content - content script ready"));
  });

  it("reports magnet links on pointer down before Chrome opens the native menu", async () => {
    document.body.innerHTML = '<a href="magnet:?xt=urn:btih:test"><span id="target">magnet</span></a>';
    // @ts-expect-error contextMenu.ts is intentionally a classic script for Chrome content script loading.
    await import("./contextMenu");

    document.getElementById("target")?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 2 }));

    expect(sendMessage).toHaveBeenCalledWith({
      type: "browserLink.contextMenuTarget",
      href: "magnet:?xt=urn:btih:test"
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Browser Downloader Content - context target detected"));
  });

  it("reports null when pointer moves over an unsupported link", async () => {
    document.body.innerHTML = '<a href="javascript:alert(1)"><span id="target">bad</span></a>';
    // @ts-expect-error contextMenu.ts is intentionally a classic script for Chrome content script loading.
    await import("./contextMenu");

    document.getElementById("target")?.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));

    expect(sendMessage).toHaveBeenCalledWith({
      type: "browserLink.contextMenuTarget",
      href: null
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Browser Downloader Content - context target cleared"));
  });
});
