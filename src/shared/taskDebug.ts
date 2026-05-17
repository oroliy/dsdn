import type { DownloadTask } from "./types";

export function summarizeTasksForDebug(tasks: DownloadTask[]) {
  return {
    count: tasks.length,
    tasks: tasks.map((task) => ({
      title: task.title,
      status: task.status,
      progress: `${task.progress}%`,
      size: `${formatBytes(task.downloadedBytes)} / ${formatBytes(task.totalBytes)}`,
      downloadSpeed: `${formatBytes(task.downloadSpeed)}/s`,
      ...(task.uploadSpeed > 0 ? { uploadSpeed: `${formatBytes(task.uploadSpeed)}/s` } : {}),
      ...(task.destination ? { destination: task.destination } : {}),
      ...(task.createdAt ? { createdAt: formatTimestamp(task.createdAt) } : {}),
      ...(task.completedAt ? { completedAt: formatTimestamp(task.completedAt) } : {}),
      ...(task.error ? { error: task.error } : {})
    }))
  };
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatTimestamp(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}
