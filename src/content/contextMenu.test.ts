import { describe, expect, it, beforeEach, vi } from "vitest";

const sendMessage = vi.fn();

describe("content context menu reporter", () => {
  beforeEach(() => {
    vi.resetModules();
    sendMessage.mockReset();
    Object.defineProperty(globalThis, "chrome", {
      value: {
        runtime: {
          sendMessage
        }
      },
      configurable: true
    });
  });

  it("reports magnet links on pointer down before Chrome opens the native menu", async () => {
    document.body.innerHTML = '<a href="magnet:?xt=urn:btih:test"><span id="target">magnet</span></a>';
    await import("./contextMenu");

    document.getElementById("target")?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 2 }));

    expect(sendMessage).toHaveBeenCalledWith({
      type: "browserLink.contextMenuTarget",
      href: "magnet:?xt=urn:btih:test"
    });
  });

  it("reports null when pointer moves over an unsupported link", async () => {
    document.body.innerHTML = '<a href="javascript:alert(1)"><span id="target">bad</span></a>';
    await import("./contextMenu");

    document.getElementById("target")?.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));

    expect(sendMessage).toHaveBeenCalledWith({
      type: "browserLink.contextMenuTarget",
      href: null
    });
  });
});
