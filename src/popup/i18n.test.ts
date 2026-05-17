import { describe, expect, it } from "vitest";
import { getMessages } from "./i18n";

describe("getMessages", () => {
  it("returns English and Chinese labels", () => {
    expect(getMessages("en").refresh).toBe("Refresh");
    expect(getMessages("zh").refresh).toBe("刷新");
  });
});
