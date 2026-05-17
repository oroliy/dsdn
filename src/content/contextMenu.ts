import { findSupportedLinkHref } from "./linkDetection";

document.addEventListener(
  "contextmenu",
  (event) => {
    void chrome.runtime.sendMessage({
      type: "browserLink.contextMenuTarget",
      href: findSupportedLinkHref(event.target)
    });
  },
  true
);
