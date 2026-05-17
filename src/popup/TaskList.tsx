import { useMemo, useState } from "react";
import type { Messages } from "./i18n";
import type { DownloadTask } from "../shared/types";

type TaskListProps = {
  tasks: DownloadTask[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onAddClick: () => void;
  onTaskClick?: (task: DownloadTask) => void;
  t: Messages;
};

export function TaskList({ tasks, loading, error, onRefresh, onAddClick, onTaskClick, t }: TaskListProps) {
  const [sortBy, setSortBy] = useState<SortBy>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filter, setFilter] = useState<TaskFilter>("all");
  const visibleTasks = useMemo(() => sortTasks(filterTasks(tasks, filter), sortBy, sortDirection), [tasks, filter, sortBy, sortDirection]);

  return (
    <section className="panel">
      <div className="toolbar">
        <h1>Download Station</h1>
        <div className="actions">
          <button type="button" className="secondary" onClick={onRefresh} disabled={loading}>
            {t.refresh}
          </button>
          <button type="button" onClick={onAddClick}>
            {t.add}
          </button>
        </div>
      </div>
      <div className="sort-row">
        <label>
          {t.filter}
          <select aria-label={t.filter} value={filter} onChange={(event) => setFilter(event.target.value as TaskFilter)}>
            <option value="all">{t.all}</option>
            <option value="downloading">{t.downloading}</option>
            <option value="finished">{t.finished}</option>
          </select>
        </label>
        <label>
          {t.sortBy}
          <select aria-label={t.sortBy} value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)}>
            <option value="title">{t.title}</option>
            <option value="status">{t.status}</option>
            <option value="progress">{t.progress}</option>
            <option value="totalBytes">{t.size}</option>
            <option value="downloadSpeed">{t.downloadSpeed}</option>
            <option value="uploadSpeed">{t.uploadSpeed}</option>
          </select>
        </label>
        <label>
          {t.sortDirection}
          <select
            aria-label={t.sortDirection}
            value={sortDirection}
            onChange={(event) => setSortDirection(event.target.value as SortDirection)}
          >
            <option value="asc">{t.ascending}</option>
            <option value="desc">{t.descending}</option>
          </select>
        </label>
      </div>
      {loading ? <p className="muted">{t.loadingTasks}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && visibleTasks.length === 0 ? <p className="muted">{t.noActiveDownloads}</p> : null}
      <div className="task-list">
        {visibleTasks.map((task) => (
          <article
            className={onTaskClick ? "task task-clickable" : "task"}
            key={task.id}
            onClick={() => onTaskClick?.(task)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onTaskClick?.(task);
              }
            }}
            role={onTaskClick ? "button" : undefined}
            tabIndex={onTaskClick ? 0 : undefined}
          >
            <div className="task-title-row">
              <strong>{task.title}</strong>
              <span className={`status status-${task.status}`}>{translateStatus(task.status, t)}</span>
            </div>
            <div className="progress" aria-label={`${task.title} progress`}>
              <span style={{ width: `${task.progress}%` }} />
            </div>
            <div className="task-meta">
              <span>{task.progress}%</span>
              <span>
                {formatBytes(task.downloadedBytes)} / {formatBytes(task.totalBytes)}
              </span>
            </div>
            {task.status !== "finished" ? (
              <div className="task-meta">
                <span>{t.downloadSpeed} {formatBytes(task.downloadSpeed)}/s</span>
                <span>{t.uploadSpeed} {formatBytes(task.uploadSpeed)}/s</span>
              </div>
            ) : null}
            {task.error ? <p className="error">{task.error}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

type SortBy = "title" | "status" | "progress" | "totalBytes" | "downloadSpeed" | "uploadSpeed";
type SortDirection = "asc" | "desc";
type TaskFilter = "all" | "downloading" | "finished";

function filterTasks(tasks: DownloadTask[], filter: TaskFilter): DownloadTask[] {
  if (filter === "all") return tasks;
  return tasks.filter((task) => task.status === filter);
}

function sortTasks(tasks: DownloadTask[], sortBy: SortBy, direction: SortDirection): DownloadTask[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...tasks].sort((a, b) => {
    const left = a[sortBy];
    const right = b[sortBy];
    if (typeof left === "string" && typeof right === "string") {
      return left.localeCompare(right) * multiplier;
    }
    return (Number(left) - Number(right)) * multiplier;
  });
}

export function translateStatus(status: DownloadTask["status"], t: Messages): string {
  if (status === "downloading") return t.downloading;
  if (status === "finished") return t.finished;
  if (status === "paused") return t.paused;
  if (status === "waiting") return t.waiting;
  if (status === "error") return t.errorStatus;
  if (status === "unknown") return t.unknown;
  return status;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
