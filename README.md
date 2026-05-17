# Synology Download Station Chrome Extension

Chrome Manifest V3 extension for managing a Synology Download Station session.

## Features

- Save DSM connection settings locally in Chrome extension storage.
- Reuse Download Station sessions and retry once after SID expiration.
- View current download tasks with sorting and status filtering.
- Open task details from the task list.
- Add HTTP, HTTPS, FTP, and magnet downloads.
- Choose configured Download Station destination folders when available.
- Switch Popup text between English and Chinese.
- Generate a Chrome Web Store upload zip.

## Requirements

- Node.js 20.19 or newer. This project uses Node 24 in local development.
- Chrome or a Chromium browser with extension developer mode enabled.
- Synology DSM with Download Station installed and enabled.

## Development

```powershell
npm install
npm run lint
npm test
npm run build
npm run package
```

Load `dist` as an unpacked extension from `chrome://extensions`.

## Security Notes

The extension stores the DSM username and password in `chrome.storage.local`.
The Download Station SID is stored in `chrome.storage.session`.
Use HTTPS when possible and prefer a low-privilege DSM account dedicated to Download Station.

See [docs/security.md](docs/security.md) for details.

## Chrome Web Store

`npm run package` creates a zip in `release/` for Chrome Web Store upload.

See [docs/chrome-web-store.md](docs/chrome-web-store.md) for listing text, permissions explanation, privacy disclosure, and unlisted release steps.
