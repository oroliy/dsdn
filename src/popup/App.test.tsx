import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const sendMessage = vi.fn();

vi.mock("./api", () => ({
  sendMessage: (request: unknown) => sendMessage(request)
}));

describe("App", () => {
  beforeEach(() => {
    sendMessage.mockReset();
    window.history.pushState({}, "", "/");
  });

  it("renders setup form when settings are missing", async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, data: null }).mockResolvedValueOnce({ ok: true, data: null });

    render(<App />);

    expect(await screen.findByLabelText("DSM URL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save and connect" })).toBeInTheDocument();
  });

  it("saves settings, connects, and loads tasks", async () => {
    sendMessage
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: [] });

    render(<App />);

    await userEvent.type(await screen.findByLabelText("DSM URL"), "https://nas.local:5001");
    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "pass");
    await userEvent.click(screen.getByRole("button", { name: "Save and connect" }));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ type: "session.connect" }));
    expect(await screen.findByText("No active downloads.")).toBeInTheDocument();
  });

  it("shows validation for invalid base url", async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, data: null }).mockResolvedValueOnce({ ok: true, data: null });

    render(<App />);

    await userEvent.type(await screen.findByLabelText("DSM URL"), "file:///tmp/nas");
    await userEvent.click(screen.getByRole("button", { name: "Save and connect" }));

    expect(await screen.findByText("Only HTTP and HTTPS DSM URLs are supported.")).toBeInTheDocument();
  });

  it("adds a download and refreshes the task list", async () => {
    sendMessage
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({
        ok: true,
        data: { baseUrl: "https://nas.local:5001", username: "user", password: "pass" }
      })
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: [{ value: "Download", label: "Download" }] })
      .mockResolvedValueOnce({ ok: true, data: { created: 1 } })
      .mockResolvedValueOnce({ ok: true, data: [] });

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Add" }));
    expect(await screen.findByRole("option", { name: "Download" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("URLs or magnet links"), "https://example.com/file.iso");
    await userEvent.click(screen.getByRole("button", { name: "Add download" }));

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({ type: "downloads.create", uris: ["https://example.com/file.iso"], destination: undefined })
    );
  });

  it("opens a task detail view from the task list", async () => {
    sendMessage
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({
        ok: true,
        data: { baseUrl: "https://nas.local:5001", username: "user", password: "pass" }
      })
      .mockResolvedValueOnce({
        ok: true,
        data: [
          {
            id: "1",
            title: "ubuntu.iso",
            status: "finished",
            progress: 100,
            downloadedBytes: 2048,
            uploadedBytes: 128,
            totalBytes: 2048,
            downloadSpeed: 0,
            uploadSpeed: 0,
            destination: "Download",
            uri: "https://example.com/ubuntu.iso",
            createdAt: 1700000000
          }
        ]
      });

    render(<App />);

    await userEvent.click(await screen.findByText("ubuntu.iso"));

    expect(await screen.findByText("Task details")).toBeInTheDocument();
    expect(screen.getByText("Finished").closest(".detail-list")).not.toBeNull();
    expect(screen.getByText("ubuntu.iso").closest(".detail-title")?.querySelector(".status")).toBeNull();
    expect(screen.getByText("Download")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/ubuntu.iso")).toBeInTheDocument();
    expect(screen.getAllByText("2.0 KB").length).toBeGreaterThan(0);
  });

  it("saves locale changes", async () => {
    sendMessage
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({ ok: true, data: null });

    render(<App />);

    expect(await screen.findByRole("button", { name: "Save and connect" })).toBeInTheDocument();
    expect(screen.getByLabelText("Language").closest(".language-icon-select")).not.toBeNull();
    await userEvent.selectOptions(screen.getByLabelText("Language"), "zh");

    expect(sendMessage).toHaveBeenCalledWith({ type: "locale.save", locale: "zh" });
  });

  it("loads the saved locale", async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, data: "zh" }).mockResolvedValueOnce({ ok: true, data: null });

    render(<App />);

    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("zh"));
  });

  it("opens the add download page with a prefilled URI from the URL query", async () => {
    window.history.pushState({}, "", "/?view=add&uri=https%3A%2F%2Fexample.com%2Ffile.iso");
    sendMessage
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({
        ok: true,
        data: { baseUrl: "https://nas.local:5001", username: "user", password: "pass" }
      })
      .mockResolvedValueOnce({ ok: true, data: [{ value: "Download", label: "Download" }] });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Add download" })).toBeInTheDocument();
    expect(screen.getByLabelText("URLs or magnet links")).toHaveValue("https://example.com/file.iso");
    expect(await screen.findByRole("option", { name: "Download" })).toBeInTheDocument();
    expect(sendMessage).not.toHaveBeenCalledWith({ type: "tasks.list" });
  });

  it("keeps a browser link URI pending until setup connects", async () => {
    window.history.pushState({}, "", "/?view=add&uri=magnet%3A%3Fxt%3Durn%3Abtih%3Atest");
    sendMessage
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({ ok: true, data: [] });

    render(<App />);

    await userEvent.type(await screen.findByLabelText("DSM URL"), "https://nas.local:5001");
    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "pass");
    await userEvent.click(screen.getByRole("button", { name: "Save and connect" }));

    expect(await screen.findByRole("heading", { name: "Add download" })).toBeInTheDocument();
    expect(screen.getByLabelText("URLs or magnet links")).toHaveValue("magnet:?xt=urn:btih:test");
    expect(sendMessage).toHaveBeenCalledWith({ type: "destinations.list" });
  });
});
