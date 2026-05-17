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
                detail: { destination: "Download", uri: "https://example.com/ubuntu.iso", create_time: "1700000000" },
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
        createdAt: 1700000000
      }
    ]);
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

  it("lists configured destination options", async () => {
    const fetcher = vi.fn(async () =>
      json({
        success: true,
        data: {
          default_destination: "Download",
          emule_default_destination: "emule"
        }
      })
    );
    const client = createSynologyClient("https://nas.local:5001", fetcher);

    await expect(client.listDestinations("SID123")).resolves.toEqual([
      { value: "Download", label: "Download" },
      { value: "emule", label: "emule" }
    ]);
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
