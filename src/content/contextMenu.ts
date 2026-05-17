import { findSupportedLinkHref } from "./linkDetection";

let lastReportedHref: string | null | undefined;

function reportContextMenuTarget(target: EventTarget | null): void {
  const href = findSupportedLinkHref(target);
  if (href === lastReportedHref) return;
  lastReportedHref = href;
  void chrome.runtime.sendMessage({
    type: "browserLink.contextMenuTarget",
    href
  });
}

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
