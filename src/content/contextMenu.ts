let lastReportedHref: string | null | undefined;

function reportContextMenuTarget(target: EventTarget | null): void {
  const href = findSupportedLinkHref(target);
  if (href === lastReportedHref) {
    debugLog("browser downloader content", "context target unchanged", {
      href: href ?? "(none)"
    });
    return;
  }
  lastReportedHref = href;
  debugLog("browser downloader content", href ? "context target detected" : "context target cleared", {
    href: href ?? "(none)",
    element: describeTarget(target)
  });
  const response = chrome.runtime.sendMessage({
    type: "browserLink.contextMenuTarget",
    href
  });
  if (isPromiseLike(response)) {
    void response
      .then(() => {
        debugLog("browser downloader content", "context target sent to background", { href: href ?? "(none)" });
      })
      .catch((error: unknown) => {
        debugLog("browser downloader content", "context target send failed", {
          href: href ?? "(none)",
          message: error instanceof Error ? error.message : String(error)
        });
      });
  } else {
    debugLog("browser downloader content", "context target dispatched to background", { href: href ?? "(none)" });
  }
}

debugLog("browser downloader content", "content script ready", {
  url: window.location.href
});
document.addEventListener("pointerover", (event) => reportContextMenuTarget(event.target), true);
document.addEventListener(
  "pointerdown",
  (event) => {
    if (event instanceof MouseEvent && event.button !== 2) return;
    reportContextMenuTarget(event.target);
  },
  true
);
document.addEventListener("contextmenu", (event) => reportContextMenuTarget(event.target), true);

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return Boolean(value && typeof value === "object" && "then" in value && typeof value.then === "function");
}

function describeTarget(target: EventTarget | null): string {
  if (!(target instanceof Element)) return "(non-element)";
  const id = target.id ? `#${target.id}` : "";
  const classes = Array.from(target.classList)
    .slice(0, 3)
    .map((item) => `.${item}`)
    .join("");
  return `${target.tagName.toLowerCase()}${id}${classes}`;
}

function findSupportedLinkHref(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;

  const link = target.closest("a[href]");
  if (!(link instanceof HTMLAnchorElement)) return null;

  const href = (link.getAttribute("href") || link.href).trim();
  if (!isSupportedDownloadUri(href)) return null;

  return href;
}

function isSupportedDownloadUri(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith("magnet:?")) return true;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  return ["http:", "https:", "ftp:"].includes(parsed.protocol);
}

function debugLog(scope: string, message: string, data?: Record<string, unknown>): void {
  const header = `[Synology Download Station] ${formatScope(scope)} - ${message}`;
  if (!data) {
    console.log(header);
    return;
  }

  console.log(
    [
      header,
      ...Object.entries(data).map(([key, value]) => `  ${formatKey(key)}: ${typeof value === "string" ? value : String(value)}`)
    ].join("\n")
  );
}

function formatScope(scope: string): string {
  return scope
    .split(/[\s:._-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
}
