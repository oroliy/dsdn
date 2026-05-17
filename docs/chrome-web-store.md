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

## First-Time Store Setup

The first release must be created in the Chrome Web Store Developer Dashboard before GitHub can automate updates.

1. Build the package locally:

```powershell
npm test
npm run lint
npm run build
npm run package
```

2. Upload `release/synology-download-station-extension-0.1.0.zip`.
3. Fill in the store listing using the descriptions above.
4. Set visibility to `Unlisted`.
5. Complete the privacy disclosure:
   - The extension does not collect or sell user data.
   - DSM credentials are stored only in Chrome extension local storage.
   - Network requests go only to the DSM URL configured by the user.
6. Publish once manually.
7. Record the Chrome Web Store extension ID and publisher ID.

## GitHub Automated Updates

After the first manual publish, version updates can be automated by `.github/workflows/chrome-web-store-release.yml`.

### Required GitHub Secrets

Add these repository secrets:

- `CWS_CLIENT_ID`
- `CWS_CLIENT_SECRET`
- `CWS_REFRESH_TOKEN`
- `CWS_PUBLISHER_ID`
- `CWS_EXTENSION_ID`

The OAuth refresh token must be created for the `https://www.googleapis.com/auth/chromewebstore` scope.

### Release Command

Use tag-based releases so each Chrome Web Store upload has an explicit version bump:

```powershell
npm version patch
npm run version:sync
npm run version:check
git push
git push origin v0.1.1
```

The workflow will run tests, type check, build, package, publish a GitHub Release asset, upload the ZIP to Chrome Web Store API v2, and submit the item for review. Chrome review still applies; automation does not bypass review.

The GitHub Release asset is the generated package:

```text
synology-download-station-extension-<version>.zip
```

If a release for the tag already exists, the workflow replaces that ZIP asset with the newly generated package.

Chrome Web Store publishing runs only when all `CWS_*` repository secrets are configured. If any of those secrets are missing, the workflow still creates the GitHub Release and clearly logs that Chrome Web Store publishing was skipped.

### Local Dry Run

Before configuring secrets, verify the publish script shape:

```powershell
npm run publish:cws -- --dry-run
```

The dry run prints the package path and API endpoints without requiring or printing secrets.
