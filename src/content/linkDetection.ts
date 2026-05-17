import { isSupportedDownloadUri } from "../shared/downloadUris";

export function findSupportedLinkHref(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;

  const link = target.closest("a[href]");
  if (!(link instanceof HTMLAnchorElement)) return null;

  const href = (link.getAttribute("href") || link.href).trim();
  if (!isSupportedDownloadUri(href)) return null;

  return href;
}
