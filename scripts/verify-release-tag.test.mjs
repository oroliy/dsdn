import { describe, expect, it } from "vitest";
import { verifyReleaseTag } from "./verify-release-tag.mjs";

describe("verifyReleaseTag", () => {
  it("accepts a tag matching the package version", () => {
    expect(verifyReleaseTag({ packageVersion: "1.2.3", refName: "v1.2.3" })).toBe("1.2.3");
  });

  it("rejects a tag that does not match the package version", () => {
    expect(() => verifyReleaseTag({ packageVersion: "1.2.3", refName: "v1.2.4" })).toThrow(
      "Release tag v1.2.4 does not match package version 1.2.3."
    );
  });
});
