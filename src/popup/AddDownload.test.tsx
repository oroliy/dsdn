import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddDownload } from "./AddDownload";
import { getMessages } from "./i18n";

const t = getMessages("en");

describe("AddDownload", () => {
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

  it("prefills initial URIs from a browser link action", () => {
    render(
      <AddDownload
        loading={false}
        error={null}
        initialUris={["magnet:?xt=urn:btih:test"]}
        onCancel={vi.fn()}
        onCreate={vi.fn()}
        t={t}
      />
    );

    expect(screen.getByLabelText("URLs or magnet links")).toHaveValue("magnet:?xt=urn:btih:test");
  });
});
