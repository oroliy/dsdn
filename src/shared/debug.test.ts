import { describe, expect, it, vi } from "vitest";
import { debugLog } from "./debug";

describe("debugLog", () => {
  it("writes visible human-readable console log output with redacted secrets", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    debugLog("test", "message", {
      sid: "secret",
      password: "pass",
      url: "https://nas.local/webapi/task.cgi?_sid=secret&passwd=pass&method=list",
      request: { method: "GET", retry: false },
      values: ["one", "two"]
    });

    expect(log).toHaveBeenCalledWith(
      [
        "[Synology Download Station] Test - message",
        "  sid: <redacted>",
        "  password: <redacted>",
        "  url: https://nas.local/webapi/task.cgi?_sid=%3Credacted%3E&passwd=%3Credacted%3E&method=list",
        "  request:",
        "    method: GET",
        "    retry: false",
        "  values:",
        "    - one",
        "    - two"
      ].join("\n")
    );
  });
});
