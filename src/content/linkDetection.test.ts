import { describe, expect, it } from "vitest";
import { findSupportedLinkHref } from "./linkDetection";

describe("findSupportedLinkHref", () => {
  it("finds supported links from nested right-click targets", () => {
    document.body.innerHTML = '<a href="magnet:?xt=urn:btih:test"><span id="target">magnet</span></a>';

    expect(findSupportedLinkHref(document.getElementById("target"))).toBe("magnet:?xt=urn:btih:test");
  });

  it("rejects unsupported link schemes", () => {
    document.body.innerHTML = '<a href="javascript:alert(1)"><span id="target">bad</span></a>';

    expect(findSupportedLinkHref(document.getElementById("target"))).toBeNull();
  });

  it("returns null outside links", () => {
    document.body.innerHTML = '<button id="target">not a link</button>';

    expect(findSupportedLinkHref(document.getElementById("target"))).toBeNull();
  });
});
