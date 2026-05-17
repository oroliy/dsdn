import { describe, expect, it } from "vitest";
import { buildAddDownloadPagePath, isSupportedDownloadUri, parseDownloadUris } from "./downloadUris";

describe("download URI helpers", () => {
  it("parses newline separated URIs", () => {
    expect(parseDownloadUris("https://a.test/file.iso\n\n magnet:?xt=urn:btih:test ")).toEqual([
      "https://a.test/file.iso",
      "magnet:?xt=urn:btih:test"
    ]);
  });

  it("accepts only supported download schemes", () => {
    expect(isSupportedDownloadUri("http://example.com/file.iso")).toBe(true);
    expect(isSupportedDownloadUri("https://example.com/file.iso")).toBe(true);
    expect(isSupportedDownloadUri("ftp://example.com/file.iso")).toBe(true);
    expect(isSupportedDownloadUri("magnet:?xt=urn:btih:test")).toBe(true);
    expect(isSupportedDownloadUri("")).toBe(false);
    expect(isSupportedDownloadUri("plain text")).toBe(false);
    expect(isSupportedDownloadUri("javascript:alert(1)")).toBe(false);
    expect(isSupportedDownloadUri("file:///tmp/file.iso")).toBe(false);
    expect(isSupportedDownloadUri("magnet:xt=urn:btih:test")).toBe(false);
  });

  it("builds an extension add-download page path with an encoded URI", () => {
    const uri = "magnet:?xt=urn:btih:test&dn=Ubuntu ISO";

    expect(buildAddDownloadPagePath(uri)).toBe(`index.html?${new URLSearchParams({ view: "add", uri }).toString()}`);
  });
});
