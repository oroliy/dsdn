export function parseDownloadUris(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isSupportedDownloadUri(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith("magnet:?")) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "ftp:";
  } catch {
    return false;
  }
}

export function buildAddDownloadPagePath(uri: string): string {
  return `index.html?${new URLSearchParams({ view: "add", uri }).toString()}`;
}
