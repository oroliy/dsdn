const PREFIX = "[Synology Download Station]";

export function debugLog(scope: string, message: string, data?: unknown): void {
  if (data === undefined) {
    console.log(`${PREFIX} ${scope}: ${message}`);
    return;
  }
  console.log(`${PREFIX} ${scope}: ${message}`, redact(data));
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
      if (/password|passwd|sid/i.test(key)) {
        return [key, "<redacted>"];
      }
      return [key, redact(item)];
    })
  );
}
