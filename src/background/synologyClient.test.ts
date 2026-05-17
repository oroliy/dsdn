import { describe, expect, it, vi } from "vitest";
import { AppError } from "./errors";
import { createSynologyClient, validateBaseUrl } from "./synologyClient";

describe("createSynologyClient", () => {
  it("logs in and returns a sid", async () => {
    const fetcher = vi.fn(async () => json({ success: true, data: { sid: "SID123" } }));
    const client = createSynologyClient("https://nas.local:5001", fetcher);

    await expect(client.login("user", "pass")).resolves.toEqual({ sid: "SID123", createdAt: expect.any(Number) });
  });

  it("normalizes task list responses", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fetcher = vi.fn(async () =>
      json({
        success: true,
        data: {
          tasks: [
            {
              id: "dbid_1",
              type: "http",
              username: "admin",
              title: "ubuntu.iso",
              size: "1000",
              status: "downloading",
              additional: {
                detail: {
                  destination: "Download",
                  uri: "https://example.com/ubuntu.iso",
                  create_time: "1700000000",
                  completed_time: "1700003600"
                },
                transfer: { size_downloaded: 250, size_uploaded: 5, speed_download: 10, speed_upload: 2 }
              }
            }
          ]
        }
      })
    );
    const client = createSynologyClient("https://nas.local:5001", fetcher);

    await expect(client.listTasks("SID123")).resolves.toEqual([
      {
        id: "dbid_1",
        type: "http",
        username: "admin",
        title: "ubuntu.iso",
        status: "downloading",
        progress: 25,
        downloadedBytes: 250,
        uploadedBytes: 5,
        totalBytes: 1000,
        downloadSpeed: 10,
        uploadSpeed: 2,
        destination: "Download",
        uri: "https://example.com/ubuntu.iso",
        createdAt: 1700000000,
        completedAt: 1700003600
      }
    ]);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        [
          "[Synology Download Station] Api - listed tasks",
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

  it("calculates progress from top-level size and string transfer fields", async () => {
    const fetcher = vi.fn(async () =>
      json({
        success: true,
        data: {
          tasks: [
            {
              id: "dbid_2",
              title: "movie.mkv",
              size: "2000",
              status: "downloading",
              additional: {
                transfer: { size_downloaded: "500", speed_download: "25", speed_upload: "3" }
              }
            }
          ]
        }
      })
    );
    const client = createSynologyClient("https://nas.local:5001", fetcher);

    await expect(client.listTasks("SID123")).resolves.toMatchObject([
      {
        progress: 25,
        downloadedBytes: 500,
        totalBytes: 2000,
        downloadSpeed: 25,
        uploadSpeed: 3
      }
    ]);
  });

  it("lists configured and writable File Station destination options", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("method=getconfig")) {
        return json({
          success: true,
          data: {
            default_destination: "Download",
            emule_default_destination: "emule"
          }
        });
      }
      if (url.includes("session=FileStation") && url.includes("method=login")) {
        return json({ success: true, data: { sid: "FILE_SID" } });
      }
      if (url.includes("method=list_share")) {
        return json({
          success: true,
          data: {
            shares: [
              { name: "Download", path: "/Download" },
              { name: "Media", path: "/Media" }
            ]
          }
        });
      }
      return json({ success: true });
    });
    const client = createSynologyClient("https://nas.local:5001", fetcher);

    await expect(client.listDestinations("SID123", "user", "pass")).resolves.toEqual([
      { value: "Download", label: "Download" },
      { value: "emule", label: "emule" },
      { value: "Media", label: "Media" }
    ]);
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("api=SYNO.FileStation.List"), undefined);
  });

  it("falls back to configured destinations when File Station directory listing is unavailable", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("method=getconfig")) {
        return json({ success: true, data: { default_destination: "Download" } });
      }
      return json({ success: false, error: { code: 107 } });
    });
    const client = createSynologyClient("https://nas.local:5001", fetcher);

    await expect(client.listDestinations("SID123", "user", "pass")).resolves.toEqual([{ value: "Download", label: "Download" }]);
  });

  it("creates tasks with an urlencoded POST body", async () => {
    const fetcher = vi.fn(async () => json({ success: true }));
    const client = createSynologyClient("https://nas.local:5001", fetcher);

    await expect(client.createDownload("SID123", ["https://example.com/file.iso"])).resolves.toEqual({ created: 1 });
    expect(fetcher).toHaveBeenCalledWith(
      "https://nas.local:5001/webapi/DownloadStation/task.cgi",
      expect.objectContaining({ method: "POST", body: expect.any(URLSearchParams) })
    );
  });

  it("rejects non-http base urls", () => {
    expect(() => validateBaseUrl("file:///tmp/dsm")).toThrow(AppError);
  });

  it("normalizes paths and rejects credentials in base urls", () => {
    expect(validateBaseUrl("https://nas.local:5001/webman/index.cgi?x=1")).toBe("https://nas.local:5001");
    expect(() => validateBaseUrl("https://user:pass@nas.local:5001")).toThrow(AppError);
  });
});

function json(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as Response;
}
