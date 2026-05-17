# Chrome Web Store GitHub Release Automation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish the extension to Chrome Web Store as an unlisted item and automate future version uploads from GitHub.

**Architecture:** Keep the first store item creation and listing/privacy setup manual because Chrome Web Store requires dashboard fields before publishing. After the extension ID exists, GitHub Actions builds, tests, packages, uploads the ZIP through Chrome Web Store API v2, and submits it for review on version-tag pushes.

**Tech Stack:** Chrome Web Store Developer Dashboard, Chrome Web Store API v2, GitHub Actions, Node 24, Vite, PowerShell packaging script.

---

## Source Notes

- Official Chrome Web Store API setup requires enabling the API, configuring OAuth, obtaining a refresh token, and using publisher/item API endpoints.
- Chrome Web Store API upload fails if `manifest.json` version was not increased.
- API publish keeps the item's existing visibility settings, so set the item to `Unlisted` in the dashboard and publish manually once before relying on automated publish.
- Unlisted extensions are installable only by users with the link and do not appear in store search.

## Required Manual Setup

1. Create or use a Chrome Web Store developer account with 2-step verification enabled.
2. Run local release checks:

```powershell
npm test
npm run lint
npm run build
npm run package
```

3. Upload `release/synology-download-station-extension-0.1.0.zip` in the Chrome Web Store Developer Dashboard.
4. Complete Store listing and Privacy tabs:
   - Visibility: `Unlisted`.
   - Single purpose: manage the user's own Synology Download Station tasks from the popup.
   - Privacy: no collection, no third-party transfer, credentials only stored locally and sent only to configured DSM URL.
   - Permissions: explain `storage`, `http://*/`, and `https://*/`.
5. Publish once manually and record:
   - `EXTENSION_ID`
   - `PUBLISHER_ID`
6. In Google Cloud Console:
   - Enable Chrome Web Store API.
   - Create OAuth consent screen.
   - Create OAuth client.
   - Use OAuth Playground with scope `https://www.googleapis.com/auth/chromewebstore` to get a refresh token.
7. Add GitHub repository secrets:
   - `CWS_CLIENT_ID`
   - `CWS_CLIENT_SECRET`
   - `CWS_REFRESH_TOKEN`
   - `CWS_PUBLISHER_ID`
   - `CWS_EXTENSION_ID`

## Release Policy

Do not publish on every push to `master`. Chrome Web Store requires monotonically increasing manifest versions and each upload enters review. Use version tags:

```powershell
npm version patch
git push
git push origin v0.1.1
```

The workflow should run on `push.tags: ["v*.*.*"]`.

## Task 1: Keep Manifest Version in Sync

**Files:**
- Create: `scripts/sync-manifest-version.mjs`
- Modify: `package.json`
- Test: `scripts/sync-manifest-version.test.mjs` or a package script smoke test

**Step 1: Write a failing script smoke check**

Run:

```powershell
node scripts/sync-manifest-version.mjs --check
```

Expected before implementation: script missing.

**Step 2: Implement the script**

The script should:
- Read `package.json`.
- Read `public/manifest.json`.
- With `--check`, fail if versions differ.
- Without `--check`, write `public/manifest.json.version = package.json.version`.

**Step 3: Add package scripts**

Add:

```json
{
  "scripts": {
    "version:sync": "node scripts/sync-manifest-version.mjs",
    "version:check": "node scripts/sync-manifest-version.mjs --check"
  }
}
```

**Step 4: Verify**

Run:

```powershell
npm run version:check
npm run lint
npm test
```

## Task 2: Create Chrome Web Store Publish Script

**Files:**
- Create: `scripts/publish-chrome-web-store.mjs`
- Modify: `package.json`

**Step 1: Write a dry-run behavior**

Run:

```powershell
node scripts/publish-chrome-web-store.mjs --dry-run
```

Expected before implementation: script missing.

**Step 2: Implement script**

The script should:
- Require `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_PUBLISHER_ID`, `CWS_EXTENSION_ID`.
- Find the ZIP in `release/synology-download-station-extension-${package.version}.zip`.
- Request an access token from `https://oauth2.googleapis.com/token`.
- Upload ZIP to `https://chromewebstore.googleapis.com/upload/v2/publishers/${publisherId}/items/${extensionId}:upload`.
- Submit publish to `https://chromewebstore.googleapis.com/v2/publishers/${publisherId}/items/${extensionId}:publish`.
- Print human-readable status.
- Never print secrets.

**Step 3: Add package script**

```json
{
  "scripts": {
    "publish:cws": "node scripts/publish-chrome-web-store.mjs"
  }
}
```

**Step 4: Verify dry run**

Run:

```powershell
npm run publish:cws -- --dry-run
```

## Task 3: Add GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/chrome-web-store-release.yml`

**Step 1: Create workflow**

Workflow:

```yaml
name: Chrome Web Store Release

on:
  push:
    tags:
      - "v*.*.*"

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run version:check
      - run: npm test
      - run: npm run lint
      - run: npm run build
      - run: npm run package
        shell: pwsh
      - run: npm run publish:cws
        env:
          CWS_CLIENT_ID: ${{ secrets.CWS_CLIENT_ID }}
          CWS_CLIENT_SECRET: ${{ secrets.CWS_CLIENT_SECRET }}
          CWS_REFRESH_TOKEN: ${{ secrets.CWS_REFRESH_TOKEN }}
          CWS_PUBLISHER_ID: ${{ secrets.CWS_PUBLISHER_ID }}
          CWS_EXTENSION_ID: ${{ secrets.CWS_EXTENSION_ID }}
```

**Step 2: Verify workflow syntax**

Run:

```powershell
npm run lint
```

Manual validation happens after secrets are configured by pushing a test tag.

## Task 4: Update Release Documentation

**Files:**
- Modify: `docs/chrome-web-store.md`

**Step 1: Add first-time publish instructions**

Document:
- Dashboard upload.
- Unlisted visibility.
- Store listing fields.
- Privacy disclosures.
- Extension ID and Publisher ID capture.

**Step 2: Add automated release instructions**

Document:
- GitHub secrets.
- Version bump command.
- Tag push command.
- Expected workflow behavior.
- Chrome review still applies after automated publish.

## Task 5: Verification and Commit

Run:

```powershell
npm run version:check
npm test
npm run lint
npm run build
npm run package
```

Commit:

```powershell
git add package.json scripts .github docs/chrome-web-store.md
git commit -m "Add Chrome Web Store release automation"
git push
```

## Rollout Checklist

1. Manually publish v0.1.0 as unlisted.
2. Add GitHub secrets.
3. Run `npm version patch`.
4. Run `npm run version:sync` if needed.
5. Commit and push version bump.
6. Push tag.
7. Confirm GitHub Actions upload succeeds.
8. Confirm Chrome Web Store item enters review.
