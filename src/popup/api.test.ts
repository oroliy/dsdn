import { describe, expect, it, vi } from "vitest";
import { sendMessage } from "./api";

describe("sendMessage", () => {
  it("logs task list response summaries in the popup console", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    globalThis.chrome = {
      runtime: {
        sendMessage: vi.fn(async () => ({
          ok: true,
          data: [
            {
              id: "dbid_1",
              title: "ubuntu.iso",
              status: "downloading",
              progress: 25,
              downloadedBytes: 250,
              uploadedBytes: 0,
              totalBytes: 1000,
              downloadSpeed: 10,
              uploadSpeed: 0
            }
          ]
        }))
      }
    } as unknown as typeof chrome;

    await sendMessage({ type: "tasks.list" });

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        [
          "[Synology Download Station] Popup - received task list",
          "  count: 1",
          "  tasks:",
          "    -",
          "      title: ubuntu.iso",
          "      status: downloading",
          "      progress: 25%",
          "      size: 250 B / 1000 B",
          "      download speed: 10 B/s"
        ].join("\n")
      )
    );
  });
});
