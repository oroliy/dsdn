import { describe, expect, it } from "vitest";
import { isExtensionRequest } from "./messages";

describe("isExtensionRequest", () => {
  it("accepts known request types", () => {
    expect(isExtensionRequest({ type: "tasks.list" })).toBe(true);
    expect(isExtensionRequest({ type: "destinations.list" })).toBe(true);
    expect(isExtensionRequest({ type: "downloads.create", uris: ["magnet:?xt=urn:btih:test"] })).toBe(true);
  });

  it("rejects unknown request types", () => {
    expect(isExtensionRequest({ type: "unknown" })).toBe(false);
    expect(isExtensionRequest(null)).toBe(false);
  });
});
