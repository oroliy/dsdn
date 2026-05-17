import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("content script entry", () => {
  it("is self-contained so Chrome can run it as a classic content script", () => {
    const content = readFileSync(resolve(process.cwd(), "src/content/contextMenu.ts"), "utf8");

    expect(content).not.toMatch(/\bimport\s*(?:[\w*{]|["'])/);
  });
});
