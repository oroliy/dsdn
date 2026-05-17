import { describe, expect, it, vi } from "vitest";
import { debugLog } from "./debug";

describe("debugLog", () => {
  it("writes visible console log output with redacted secrets", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    debugLog("test", "message", { sid: "secret", password: "pass", value: "ok" });

    expect(log).toHaveBeenCalledWith("[Synology Download Station] test: message", {
      sid: "<redacted>",
      password: "<redacted>",
      value: "ok"
    });
  });
});
