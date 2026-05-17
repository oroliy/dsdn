# Synology Download Station Chrome Extension

Chrome Manifest V3 extension for managing a Synology Download Station session.

## Features

- Save DSM connection settings locally in Chrome extension storage.
- Reuse Download Station sessions and retry once after SID expiration.
- View current download tasks with sorting and status filtering.
- Open task details from the task list.
- Add HTTP, HTTPS, FTP, and magnet downloads.
- Right-click supported links in Chrome and open the add-download page with the link prefilled.
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

## Manual Installation

### Install from GitHub Release

1. Open the latest release:
   <https://github.com/oroliy/dsdn/releases/latest>
2. Download `synology-download-station-extension-<version>.zip` from the release assets.
3. Extract the zip to a local folder. Chrome cannot load the zip directly as an unpacked extension.
4. Open Chrome and go to `chrome://extensions`.
5. Enable `Developer mode`.
6. Click `Load unpacked`.
7. Select the folder created by extracting the zip.
8. Pin `Synology Download Station` from the Chrome extensions menu if desired.

### Install from Source

```powershell
npm install
npm run build
```

Then open `chrome://extensions`, enable `Developer mode`, click `Load unpacked`, and select the `dist` folder.

After installation, open the extension popup and enter:

- DSM URL, for example `https://nas.local:5001`
- DSM username
- DSM password

For best results, use HTTPS and a DSM account with only the permissions needed for Download Station.

To add a link from a web page, right-click an HTTP, HTTPS, FTP, or magnet link and choose `Add to Download Station / 添加到 Download Station`. The extension opens a compact add-download window with the link already filled in.

## Security Notes

The extension stores the DSM username and password in `chrome.storage.local`.
The Download Station SID is stored in `chrome.storage.session`.
Use HTTPS when possible and prefer a low-privilege DSM account dedicated to Download Station.

See [docs/security.md](docs/security.md) for details.

## Chrome Web Store

`npm run package` creates a zip in `release/` for Chrome Web Store upload.

See [docs/chrome-web-store.md](docs/chrome-web-store.md) for listing text, permissions explanation, privacy disclosure, and unlisted release steps.
