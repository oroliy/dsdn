import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getMessages } from "./i18n";
import { formatBytes, TaskList } from "./TaskList";

const t = getMessages("en");

describe("TaskList", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("renders task title, status, progress, size, and speeds", () => {
    render(
      <TaskList
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onAddClick={vi.fn()}
        t={t}
        tasks={[
          {
            id: "1",
            title: "ubuntu.iso",
            status: "downloading",
            progress: 25,
            downloadedBytes: 512,
            uploadedBytes: 0,
            totalBytes: 2048,
            downloadSpeed: 1024,
            uploadSpeed: 0
          }
        ]}
      />
    );

    expect(screen.getByText("ubuntu.iso")).toBeInTheDocument();
    expect(screen.getAllByText("Downloading").length).toBeGreaterThan(0);
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("512 B / 2.0 KB")).toBeInTheDocument();
    expect(screen.getByText("Download speed 1.0 KB/s")).toBeInTheDocument();
  });

  it("does not render transfer speeds for finished tasks", () => {
    render(
      <TaskList
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onAddClick={vi.fn()}
        t={t}
        tasks={[
          {
            id: "1",
            title: "done.iso",
            status: "finished",
            progress: 100,
            downloadedBytes: 2048,
            uploadedBytes: 0,
            totalBytes: 2048,
            downloadSpeed: 1024,
            uploadSpeed: 512
          }
        ]}
      />
    );

    expect(screen.queryByText("Download speed 1.0 KB/s")).not.toBeInTheDocument();
    expect(screen.queryByText("Upload speed 512 B/s")).not.toBeInTheDocument();
  });

  it("opens a task when the row is clicked", () => {
    const onTaskClick = vi.fn();
    render(
      <TaskList
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onAddClick={vi.fn()}
        onTaskClick={onTaskClick}
        t={t}
        tasks={[
          {
            id: "1",
            title: "ubuntu.iso",
            status: "downloading",
            progress: 25,
            downloadedBytes: 512,
            uploadedBytes: 0,
            totalBytes: 2048,
            downloadSpeed: 1024,
            uploadSpeed: 0
          }
        ]}
      />
    );

    fireEvent.click(screen.getByText("ubuntu.iso"));

    expect(onTaskClick).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
  });

  it("calls refresh and add actions", () => {
    const onRefresh = vi.fn();
    const onAddClick = vi.fn();
    render(<TaskList loading={false} error={null} tasks={[]} onRefresh={onRefresh} onAddClick={onAddClick} t={t} />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onRefresh).toHaveBeenCalledOnce();
    expect(onAddClick).toHaveBeenCalledOnce();
  });

  it("sorts tasks by progress descending", () => {
    render(
      <TaskList
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onAddClick={vi.fn()}
        t={t}
        tasks={[
          {
            id: "1",
            title: "low",
            status: "downloading",
            progress: 10,
            downloadedBytes: 1,
            uploadedBytes: 0,
            totalBytes: 10,
            downloadSpeed: 1,
            uploadSpeed: 0
          },
          {
            id: "2",
            title: "high",
            status: "downloading",
            progress: 90,
            downloadedBytes: 9,
            uploadedBytes: 0,
            totalBytes: 10,
            downloadSpeed: 1,
            uploadSpeed: 0
          }
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "progress" } });
    fireEvent.change(screen.getByLabelText("Sort direction"), { target: { value: "desc" } });

    const titles = screen.getAllByRole("article").map((item) => item.textContent);
    expect(titles[0]).toContain("high");
    expect(titles[1]).toContain("low");
  });

  it("sorts tasks by created and completed dates", () => {
    render(
      <TaskList
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onAddClick={vi.fn()}
        t={t}
        tasks={[
          {
            id: "1",
            title: "old done",
            status: "finished",
            progress: 100,
            downloadedBytes: 10,
            uploadedBytes: 0,
            totalBytes: 10,
            downloadSpeed: 0,
            uploadSpeed: 0,
            createdAt: 100,
            completedAt: 200
          },
          {
            id: "2",
            title: "new done",
            status: "finished",
            progress: 100,
            downloadedBytes: 10,
            uploadedBytes: 0,
            totalBytes: 10,
            downloadSpeed: 0,
            uploadSpeed: 0,
            createdAt: 300,
            completedAt: 400
          },
          {
            id: "3",
            title: "active",
            status: "downloading",
            progress: 50,
            downloadedBytes: 5,
            uploadedBytes: 0,
            totalBytes: 10,
            downloadSpeed: 1,
            uploadSpeed: 0,
            createdAt: 500
          }
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "createdAt" } });
    fireEvent.change(screen.getByLabelText("Sort direction"), { target: { value: "desc" } });
    let titles = screen.getAllByRole("article").map((item) => item.textContent);
    expect(titles[0]).toContain("active");
    expect(titles[1]).toContain("new done");
    expect(titles[2]).toContain("old done");

    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "completedAt" } });
    titles = screen.getAllByRole("article").map((item) => item.textContent);
    expect(titles[0]).toContain("new done");
    expect(titles[1]).toContain("old done");
    expect(titles[2]).toContain("active");
  });

  it("filters tasks by downloading and finished status", () => {
    render(
      <TaskList
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onAddClick={vi.fn()}
        t={t}
        tasks={[
          {
            id: "1",
            title: "active",
            status: "downloading",
            progress: 10,
            downloadedBytes: 1,
            uploadedBytes: 0,
            totalBytes: 10,
            downloadSpeed: 1,
            uploadSpeed: 0
          },
          {
            id: "2",
            title: "done",
            status: "finished",
            progress: 100,
            downloadedBytes: 10,
            uploadedBytes: 0,
            totalBytes: 10,
            downloadSpeed: 0,
            uploadSpeed: 0
          }
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText("Filter"), { target: { value: "downloading" } });
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.queryByText("done")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter"), { target: { value: "finished" } });
    expect(screen.queryByText("active")).not.toBeInTheDocument();
    expect(screen.getByText("done")).toBeInTheDocument();
  });
});
