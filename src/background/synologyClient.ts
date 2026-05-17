import { AppError } from "./errors";
import { debugLog } from "../shared/debug";
import { summarizeTasksForDebug } from "../shared/taskDebug";
import type { ApiError, DestinationOption, DownloadTask, DownloadTaskStatus, SessionState } from "../shared/types";

const AUTH_PATH = "/webapi/auth.cgi";
const INFO_PATH = "/webapi/DownloadStation/info.cgi";
const TASK_PATH = "/webapi/DownloadStation/task.cgi";
const FILE_STATION_SHARE_PATH = "/webapi/FileStation/file_share.cgi";

type Fetcher = typeof fetch;
type SynologyResponse<T> = { success: true; data?: T } | { success: false; error?: { code?: number | string } };

export type SynologyClient = ReturnType<typeof createSynologyClient>;

export function createSynologyClient(baseUrl: string, fetcher: Fetcher = fetch) {
  const normalizedBaseUrl = validateBaseUrl(baseUrl);

  return {
    async login(username: string, password: string): Promise<SessionState> {
      const url = endpoint(normalizedBaseUrl, AUTH_PATH, {
        api: "SYNO.API.Auth",
        version: 6,
        method: "login",
        account: username,
        passwd: password,
        session: "DownloadStation",
        format: "sid"
      });
      const data = await request<{ sid?: string }>(fetcher, url);
      if (!data.sid) {
        throw new AppError({ code: "missing_sid", message: "Synology login did not return a session ID.", retryable: false });
      }
      return { sid: data.sid, createdAt: Date.now() };
    },

    async logout(sid: string): Promise<void> {
      const url = endpoint(normalizedBaseUrl, AUTH_PATH, {
        api: "SYNO.API.Auth",
        version: 6,
        method: "logout",
        session: "DownloadStation",
        _sid: sid
      });
      await request(fetcher, url);
    },

    async listTasks(sid: string): Promise<DownloadTask[]> {
      const url = endpoint(normalizedBaseUrl, TASK_PATH, {
        api: "SYNO.DownloadStation.Task",
        version: 3,
        method: "list",
        additional: "detail,transfer",
        _sid: sid
      });
      const data = await request<{ tasks?: RawTask[] }>(fetcher, url);
      const tasks = (data.tasks ?? []).map(normalizeTask);
      debugLog("api", "listed tasks", summarizeTasksForDebug(tasks));
      return tasks;
    },

    async listDestinations(sid: string, username?: string, password?: string): Promise<DestinationOption[]> {
      const url = endpoint(normalizedBaseUrl, INFO_PATH, {
        api: "SYNO.DownloadStation.Info",
        version: 1,
        method: "getconfig",
        _sid: sid
      });
      const data = await request<DownloadStationConfig>(fetcher, url);
      const configured = normalizeDestinations(data);
      const writableShares = username && password ? await listWritableShares(normalizedBaseUrl, username, password, fetcher) : [];
      const destinations = mergeDestinations(configured, writableShares);
      debugLog("api", "listed destinations", { count: destinations.length, destinations });
      return destinations;
    },

    async createDownload(sid: string, uris: string[], destination?: string): Promise<{ created: number }> {
      const body = new URLSearchParams({
        api: "SYNO.DownloadStation.Task",
        version: "3",
        method: "create",
        uri: uris.join("\n"),
        _sid: sid
      });
      if (destination?.trim()) {
        body.set("destination", destination.trim());
      }

      await request(fetcher, new URL(TASK_PATH, `${normalizedBaseUrl}/`).toString(), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body
      });
      debugLog("api", "created downloads", { count: uris.length, hasDestination: Boolean(destination?.trim()) });
      return { created: uris.length };
    }
  };
}

async function listWritableShares(baseUrl: string, username: string, password: string, fetcher: Fetcher): Promise<DestinationOption[]> {
  let fileStationSid: string | null = null;
  try {
    const session = await loginToSession(baseUrl, "FileStation", username, password, fetcher);
    fileStationSid = session.sid;
    const url = endpoint(baseUrl, FILE_STATION_SHARE_PATH, {
      api: "SYNO.FileStation.List",
      version: 2,
      method: "list_share",
      onlywritable: "true",
      _sid: fileStationSid
    });
    const data = await request<FileStationShareList>(fetcher, url);
    return normalizeWritableShares(data);
  } catch (error) {
    debugLog("api", "directory listing unavailable", asDirectoryListError(error));
    return [];
  } finally {
    if (fileStationSid) {
      await logoutSession(baseUrl, "FileStation", fileStationSid, fetcher);
    }
  }
}

async function loginToSession(baseUrl: string, sessionName: string, username: string, password: string, fetcher: Fetcher): Promise<SessionState> {
  const url = endpoint(baseUrl, AUTH_PATH, {
    api: "SYNO.API.Auth",
    version: 6,
    method: "login",
    account: username,
    passwd: password,
    session: sessionName,
    format: "sid"
  });
  const data = await request<{ sid?: string }>(fetcher, url);
  if (!data.sid) {
    throw new AppError({ code: "missing_sid", message: `Synology ${sessionName} login did not return a session ID.`, retryable: false });
  }
  return { sid: data.sid, createdAt: Date.now() };
}

async function logoutSession(baseUrl: string, sessionName: string, sid: string, fetcher: Fetcher): Promise<void> {
  const url = endpoint(baseUrl, AUTH_PATH, {
    api: "SYNO.API.Auth",
    version: 6,
    method: "logout",
    session: sessionName,
    _sid: sid
  });
  try {
    await request(fetcher, url);
  } catch {
    // Directory listing is optional; failed cleanup should not break task creation.
  }
}

export function validateBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError({ code: "invalid_base_url", message: "Only HTTP and HTTPS DSM URLs are supported.", retryable: false });
  }
  if (url.username || url.password) {
    throw new AppError({ code: "invalid_base_url", message: "Do not include credentials in the DSM URL.", retryable: false });
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function normalizeSynologyError(code: number | string | undefined): ApiError {
  const normalized = String(code ?? "unknown_synology_error");
  const messages: Record<string, string> = {
    "101": "Invalid parameter.",
    "102": "The requested API does not exist.",
    "103": "The requested method does not exist.",
    "104": "The requested version is not supported.",
    "105": "The session expired. Please reconnect.",
    "106": "The session is invalid. Please reconnect.",
    "107": "Insufficient permissions for Download Station.",
    "400": "Download Station could not create the task."
  };

  return {
    code: normalized,
    message: messages[normalized] ?? `Synology API error ${normalized}.`,
    retryable: normalized === "105" || normalized === "106"
  };
}

function endpoint(baseUrl: string, path: string, params: Record<string, string | number>): string {
  const url = new URL(path, `${baseUrl}/`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return url.toString();
}

async function request<T = unknown>(fetcher: Fetcher, input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    debugLog("api", "request", {
      method: init?.method ?? "GET",
      url: typeof input === "string" ? redactUrl(input) : String(input)
    });
    response = await fetcher(input, init);
  } catch {
    throw new AppError({ code: "network_error", message: "Could not reach the configured DSM server.", retryable: true });
  }

  if (!response.ok) {
    throw new AppError({ code: "http_error", message: `DSM returned HTTP ${response.status}.`, retryable: response.status >= 500 });
  }

  const payload = (await response.json()) as SynologyResponse<T>;
  if (!payload.success) {
    throw new AppError(normalizeSynologyError(payload.error?.code));
  }

  return (payload.data ?? ({} as T)) as T;
}

function redactUrl(value: string): string {
  const url = new URL(value);
  for (const key of ["passwd", "password", "_sid", "sid"]) {
    if (url.searchParams.has(key)) {
      url.searchParams.set(key, "<redacted>");
    }
  }
  return url.toString();
}

type RawTask = {
  id?: string;
  type?: string;
  username?: string;
  title?: string;
  size?: number | string;
  status?: string;
  status_extra?: { error_detail?: string };
  additional?: {
    detail?: {
      total_size?: number | string;
      destination?: string;
      uri?: string;
      create_time?: number | string;
      completed_time?: number | string;
    };
    transfer?: {
      size_downloaded?: number | string;
      size_uploaded?: number | string;
      speed_download?: number | string;
      speed_upload?: number | string;
    };
  };
};

export function normalizeTask(raw: RawTask): DownloadTask {
  const totalBytes = toNumber(raw.additional?.detail?.total_size ?? raw.size);
  const downloadedBytes = toNumber(raw.additional?.transfer?.size_downloaded);
  const progress = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;

  return {
    id: raw.id ?? "",
    ...(raw.type ? { type: raw.type } : {}),
    ...(raw.username ? { username: raw.username } : {}),
    title: raw.title || raw.id || "Untitled download",
    status: normalizeStatus(raw.status),
    progress,
    downloadedBytes,
    uploadedBytes: toNumber(raw.additional?.transfer?.size_uploaded),
    totalBytes,
    downloadSpeed: toNumber(raw.additional?.transfer?.speed_download),
    uploadSpeed: toNumber(raw.additional?.transfer?.speed_upload),
    ...(raw.additional?.detail?.destination ? { destination: raw.additional.detail.destination } : {}),
    ...(raw.additional?.detail?.uri ? { uri: raw.additional.detail.uri } : {}),
    ...(raw.additional?.detail?.create_time ? { createdAt: toNumber(raw.additional.detail.create_time) } : {}),
    ...(raw.additional?.detail?.completed_time ? { completedAt: toNumber(raw.additional.detail.completed_time) } : {}),
    ...(raw.status_extra?.error_detail ? { error: raw.status_extra.error_detail } : {})
  };
}

type DownloadStationConfig = {
  default_destination?: string;
  emule_default_destination?: string;
};

type FileStationShareList = {
  shares?: Array<{
    name?: string;
    path?: string;
    isdir?: boolean;
  }>;
};

function normalizeDestinations(config: DownloadStationConfig): DestinationOption[] {
  return Array.from(new Set([config.default_destination, config.emule_default_destination].filter(Boolean)))
    .map((value) => String(value))
    .map((value) => ({ value, label: value }));
}

function normalizeWritableShares(data: FileStationShareList): DestinationOption[] {
  return (data.shares ?? [])
    .map((share) => normalizeSharePath(share.path ?? share.name))
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, label: value }));
}

function normalizeSharePath(path: string | undefined): string | null {
  const normalized = path?.trim().replace(/^\/+/, "");
  return normalized || null;
}

function mergeDestinations(...groups: DestinationOption[][]): DestinationOption[] {
  const seen = new Set<string>();
  return groups.flat().filter((item) => {
    if (seen.has(item.value)) return false;
    seen.add(item.value);
    return true;
  });
}

function asDirectoryListError(error: unknown) {
  if (error && typeof error === "object" && "apiError" in error) {
    return (error as { apiError: ApiError }).apiError;
  }
  return { message: "Could not list writable DSM directories." };
}

function toNumber(value: number | string | undefined): number {
  if (value === undefined || value === "") return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeStatus(value: string | undefined): DownloadTaskStatus {
  if (value === "waiting" || value === "downloading" || value === "paused" || value === "finished" || value === "error") {
    return value;
  }
  return "unknown";
}
