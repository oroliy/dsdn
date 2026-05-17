export type ConnectionSettings = {
  baseUrl: string;
  username: string;
  password: string;
};

export type SessionState = {
  sid: string;
  createdAt: number;
};

export type DownloadTaskStatus = "waiting" | "downloading" | "paused" | "finished" | "error" | "unknown";

export type DownloadTask = {
  id: string;
  type?: string;
  username?: string;
  title: string;
  status: DownloadTaskStatus;
  progress: number;
  downloadedBytes: number;
  uploadedBytes: number;
  totalBytes: number;
  downloadSpeed: number;
  uploadSpeed: number;
  destination?: string;
  uri?: string;
  createdAt?: number;
  completedAt?: number;
  error?: string;
};

export type ApiError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type DestinationOption = {
  value: string;
  label: string;
};
