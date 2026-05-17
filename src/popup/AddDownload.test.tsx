import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddDownload, isSupportedDownloadUri, parseDownloadUris } from "./AddDownload";
import { getMessages } from "./i18n";

const t = getMessages("en");

describe("AddDownload", () => {
  it("parses newline separated urls", () => {
    expect(parseDownloadUris("https://a.test/file.iso\n\n magnet:?xt=urn:btih:test ")).toEqual([
      "https://a.test/file.iso",
      "magnet:?xt=urn:btih:test"
    ]);
  });

  it("validates supported uri schemes", () => {
    expect(isSupportedDownloadUri("https://example.com/file.iso")).toBe(true);
    expect(isSupportedDownloadUri("magnet:?xt=urn:btih:test")).toBe(true);
    expect(isSupportedDownloadUri("javascript:alert(1)")).toBe(false);
  });

  it("disables submit for empty input and submits valid urls", async () => {
    const onCreate = vi.fn(async () => undefined);
    render(<AddDownload loading={false} error={null} onCancel={vi.fn()} onCreate={onCreate} t={t} />);

    const button = screen.getByRole("button", { name: "Add download" });
    expect(button).toBeDisabled();

    await userEvent.type(screen.getByLabelText("URLs or magnet links"), "https://example.com/file.iso");
    expect(button).toBeEnabled();
    fireEvent.click(button);

    expect(onCreate).toHaveBeenCalledWith(["https://example.com/file.iso"], undefined);
  });

  it("offers configured destination options and submits the selected destination", async () => {
    const onCreate = vi.fn(async () => undefined);
    render(
      <AddDownload
        loading={false}
        error={null}
        destinations={[{ value: "Download", label: "Download" }]}
        onCancel={vi.fn()}
        onCreate={onCreate}
        t={t}
      />
    );

    await userEvent.type(screen.getByLabelText("URLs or magnet links"), "https://example.com/file.iso");
    await userEvent.selectOptions(screen.getByLabelText("Destination"), "Download");
    fireEvent.click(screen.getByRole("button", { name: "Add download" }));

    expect(onCreate).toHaveBeenCalledWith(["https://example.com/file.iso"], "Download");
  });
});
