const PREFIX = "[Synology Download Station]";
const SECRET_KEY_PATTERN = /password|passwd|sid/i;

export function debugLog(scope: string, message: string, data?: unknown): void {
  const header = `${PREFIX} ${formatScope(scope)} - ${message}`;
  if (data === undefined) {
    console.log(header);
    return;
  }
  console.log([header, ...formatValue(redact(data), 1)].join("\n"));
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (SECRET_KEY_PATTERN.test(key)) {
        return [key, "<redacted>"];
      }
      return [key, redact(item)];
    })
  );
}

function formatScope(scope: string): string {
  return scope
    .split(/[\s:._-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatValue(value: unknown, depth: number): string[] {
  const indent = "  ".repeat(depth);
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${indent}(empty list)`];
    return value.flatMap((item) => {
      if (isRecord(item) || Array.isArray(item)) {
        return [`${indent}-`, ...formatValue(item, depth + 1)];
      }
      return [`${indent}- ${formatScalar(item)}`];
    });
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return [`${indent}(empty)`];
    return entries.flatMap(([key, item]) => {
      if (isRecord(item) || Array.isArray(item)) {
        return [`${indent}${formatKey(key)}:`, ...formatValue(item, depth + 1)];
      }
      return [`${indent}${formatKey(key)}: ${formatScalar(item)}`];
    });
  }

  return [`${indent}${formatScalar(value)}`];
}

function formatKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
}

function formatScalar(value: unknown): string {
  if (typeof value === "string") {
    return redactUrl(value);
  }
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  return String(value);
}

function redactUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return value;
  }

  let changed = false;
  for (const key of Array.from(parsed.searchParams.keys())) {
    if (SECRET_KEY_PATTERN.test(key)) {
      parsed.searchParams.set(key, "<redacted>");
      changed = true;
    }
  }

  return changed ? parsed.toString() : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
