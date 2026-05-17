import { describe, expect, it } from "vitest";
import { endpoints, requiredConfig } from "./publish-chrome-web-store.mjs";

describe("publish-chrome-web-store", () => {
  it("reports missing required secrets without printing secret values", () => {
    expect(() => requiredConfig({ CWS_CLIENT_ID: "client-id" })).toThrow(
      "Missing Chrome Web Store secrets: CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN, CWS_PUBLISHER_ID, CWS_EXTENSION_ID."
    );
  });

  it("builds Chrome Web Store API v2 endpoints", () => {
    expect(endpoints({ publisherId: "pub", extensionId: "ext" })).toEqual({
      upload: "https://chromewebstore.googleapis.com/upload/v2/publishers/pub/items/ext:upload",
      publish: "https://chromewebstore.googleapis.com/v2/publishers/pub/items/ext:publish"
    });
  });
});
