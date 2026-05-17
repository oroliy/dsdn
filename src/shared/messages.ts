import type { ApiError, ConnectionSettings, DestinationOption, DownloadTask } from "./types";

export type ExtensionRequest =
  | { type: "settings.get" }
  | { type: "settings.save"; settings: ConnectionSettings }
  | { type: "session.connect" }
  | { type: "session.disconnect" }
  | { type: "tasks.list" }
  | { type: "destinations.list" }
  | { type: "downloads.create"; uris: string[]; destination?: string };

export type ExtensionResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export type ExtensionResponseMap = {
  "settings.get": ConnectionSettings | null;
  "settings.save": null;
  "session.connect": null;
  "session.disconnect": null;
  "tasks.list": DownloadTask[];
  "destinations.list": DestinationOption[];
  "downloads.create": { created: number };
};

const REQUEST_TYPES = new Set<ExtensionRequest["type"]>([
  "settings.get",
  "settings.save",
  "session.connect",
  "session.disconnect",
  "tasks.list",
  "destinations.list",
  "downloads.create"
]);

export function isExtensionRequest(value: unknown): value is ExtensionRequest {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in value &&
      typeof value.type === "string" &&
      REQUEST_TYPES.has(value.type as ExtensionRequest["type"])
  );
}

export function ok<T>(data: T): ExtensionResponse<T> {
  return { ok: true, data };
}

export function fail(error: ApiError): ExtensionResponse<never> {
  return { ok: false, error };
}
