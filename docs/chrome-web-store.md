# Chrome Web Store Release Notes

## Release Channel

Use Chrome Web Store unlisted publishing for v0.1.0. The extension is intended for personal or small-group distribution.

## Store Listing

Short description:

> View and add Synology Download Station tasks from Chrome.

Detailed description:

> Synology Download Station for Chrome lets you connect to your own Synology DSM server, view active Download Station tasks, and add new downloads from URLs or magnet links. The extension talks directly to the DSM URL you configure and does not use any third-party service.

Single purpose:

> Manage a user's own Synology Download Station tasks from a Chrome popup.

## Permissions Explanation

- `storage`: Saves the DSM connection settings and the current Download Station session ID.
- `http://*/` and `https://*/`: Allows users to connect to a Synology DSM server at a LAN, VPN, hostname, or custom domain chosen at runtime.

## Privacy Disclosure

The extension does not collect, sell, transfer, or share user data. DSM credentials are stored locally in Chrome extension storage. The extension sends credentials only to the user-configured DSM server during Synology authentication.

## Submission Checklist

1. Run `npm test`.
2. Run `npm run lint`.
3. Run `npm run build`.
4. Run `npm run package`.
5. Upload `release/synology-download-station-extension-0.1.0.zip`.
6. Attach at least one popup screenshot.
7. Use the privacy disclosure above in the Chrome Web Store developer dashboard.
8. Choose unlisted visibility.
