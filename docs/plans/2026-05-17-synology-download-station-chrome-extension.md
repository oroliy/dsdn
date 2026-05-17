# Synology Download Station Chrome Extension Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Chrome extension that maintains a Synology Download Station session, shows current download tasks, and adds new downloads from URLs or magnet links.

**Architecture:** Use a Manifest V3 Chrome extension with a popup UI, background service worker, typed Synology API client, and Chrome storage for connection settings plus session metadata. The popup never calls the NAS directly; it sends typed messages to the background worker, which owns authentication, session refresh, and Download Station API calls.

**Tech Stack:** Chrome Extension Manifest V3, TypeScript, Vite, React, Vitest, Testing Library, Playwright for extension smoke tests.

---

## Assumptions

- This is a new project under `H:\Work\dsdn`.
- Target browser is Chrome only, Manifest V3.
- Synology NAS access is over HTTP(S) to a user-configured DSM base URL, for example `https://nas.example.com:5001`.
- Authentication uses Synology WebAPI `SYNO.API.Auth` and stores the returned `sid` in `chrome.storage.session`.
- Persistent settings use `chrome.storage.local`.
- The first version supports URL and magnet-link downloads only. Torrent file upload, scheduling rules, destination folder picker, and multi-NAS profiles are out of scope.
- The user is responsible for enabling Download Station and creating a DSM account with appropriate permissions.

## API Shape

Use these Synology WebAPI endpoints through a single client module:

- `GET /webapi/query.cgi?api=SYNO.API.Info&version=1&method=query&query=SYNO.API.Auth,SYNO.DownloadStation.Task`
- `GET /webapi/auth.cgi?api=SYNO.API.Auth&version=6&method=login&account=...&passwd=...&session=DownloadStation&format=sid`
- `GET /webapi/DownloadStation/task.cgi?api=SYNO.DownloadStation.Task&version=3&method=list&additional=detail,transfer`
- `GET or POST /webapi/DownloadStation/task.cgi?api=SYNO.DownloadStation.Task&version=3&method=create&uri=...`
- `GET /webapi/auth.cgi?api=SYNO.API.Auth&version=6&method=logout&session=DownloadStation`

Normalize Synology responses immediately into app-level types so UI code never depends on raw response keys.

## UX Design

The popup has three states:

- Setup: base URL, username, password, HTTPS warning, save/connect button.
- Task list: compact toolbar with refresh, add download, connection status, and task rows.
- Add download: single multiline input accepting URLs or magnet links, optional destination field, submit button, result/error message.

Task rows show title, status, progress percentage, downloaded/total size, current download/upload speed, and pause/error state. Keep the popup dense and utility-focused rather than a landing page.

## Error Handling

- If no settings exist, show setup.
- If a request gets an auth/session error, clear the session SID, re-login once, then retry the original request.
- If re-login fails, keep settings but return to setup with a clear auth error.
- If the NAS URL is invalid or unreachable, show a connection error in the popup and leave saved settings unchanged.
- If Download Station returns task-level errors, display the normalized error message near the action that caused it.

---

### Task 1: Scaffold Extension Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/popup/App.tsx`
- Create: `src/background/index.ts`
- Create: `public/manifest.json`
- Create: `public/icons/icon-16.png`
- Create: `public/icons/icon-32.png`
- Create: `public/icons/icon-48.png`
- Create: `public/icons/icon-128.png`

**Step 1: Create package metadata**

Create `package.json`:

```json
{
  "name": "synology-download-station-extension",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "vite": "^7.0.0",
    "typescript": "^5.8.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.0.0",
    "@types/chrome": "^0.0.300",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "jsdom": "^26.0.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Create TypeScript and Vite config**

Create `tsconfig.json`, `vite.config.ts`, and `vitest.config.ts` with strict TypeScript, React support, output directory `dist`, and jsdom test environment.

**Step 3: Create Manifest V3**

Create `public/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Synology Download Station",
  "version": "0.1.0",
  "description": "View and add Synology Download Station tasks from Chrome.",
  "action": {
    "default_popup": "index.html",
    "default_title": "Download Station"
  },
  "background": {
    "service_worker": "assets/background.js",
    "type": "module"
  },
  "permissions": ["storage"],
  "host_permissions": ["http://*/", "https://*/"],
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

**Step 4: Create minimal popup and background entry points**

Create `index.html`, `src/main.tsx`, `src/popup/App.tsx`, and `src/background/index.ts` with a minimal rendered popup and a background console log.

**Step 5: Run build**

Run: `npm install`

Expected: dependencies install successfully.

Run: `npm run build`

Expected: `dist/manifest.json`, popup assets, and background asset are emitted.

**Step 6: Commit**

```bash
git add package.json tsconfig.json vite.config.ts vitest.config.ts index.html src public
git commit -m "chore: scaffold chrome extension"
```

Skip the commit if the workspace is still not a git repository.

---

### Task 2: Define Shared Types and Message Protocol

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/messages.ts`
- Test: `src/shared/messages.test.ts`

**Step 1: Write message protocol tests**

Create `src/shared/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isExtensionRequest } from "./messages";

describe("isExtensionRequest", () => {
  it("accepts known request types", () => {
    expect(isExtensionRequest({ type: "tasks.list" })).toBe(true);
    expect(isExtensionRequest({ type: "downloads.create", uris: ["magnet:?xt=urn:btih:test"] })).toBe(true);
  });

  it("rejects unknown request types", () => {
    expect(isExtensionRequest({ type: "unknown" })).toBe(false);
    expect(isExtensionRequest(null)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/messages.test.ts`

Expected: FAIL because `src/shared/messages.ts` does not exist.

**Step 3: Add shared types**

Create `src/shared/types.ts`:

```ts
export type ConnectionSettings = {
  baseUrl: string;
  username: string;
  password: string;
};

export type SessionState = {
  sid: string;
  createdAt: number;
};

export type DownloadTask = {
  id: string;
  title: string;
  status: "waiting" | "downloading" | "paused" | "finished" | "error" | "unknown";
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  downloadSpeed: number;
  uploadSpeed: number;
  error?: string;
};

export type ApiError = {
  code: string;
  message: string;
  retryable: boolean;
};
```

**Step 4: Add message helpers**

Create `src/shared/messages.ts`:

```ts
import type { ConnectionSettings, DownloadTask, ApiError } from "./types";

export type ExtensionRequest =
  | { type: "settings.get" }
  | { type: "settings.save"; settings: ConnectionSettings }
  | { type: "session.connect" }
  | { type: "session.disconnect" }
  | { type: "tasks.list" }
  | { type: "downloads.create"; uris: string[]; destination?: string };

export type ExtensionResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export type ExtensionResponseMap = {
  "settings.get": ConnectionSettings | null;
  "settings.save": null;
  "session.connect": null;
  "session.disconnect": null;
  "tasks.list": DownloadTask[];
  "downloads.create": { created: number };
};

const REQUEST_TYPES = new Set<ExtensionRequest["type"]>([
  "settings.get",
  "settings.save",
  "session.connect",
  "session.disconnect",
  "tasks.list",
  "downloads.create"
]);

export function isExtensionRequest(value: unknown): value is ExtensionRequest {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in value &&
      typeof value.type === "string" &&
      REQUEST_TYPES.has(value.type as ExtensionRequest["type"])
  );
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- src/shared/messages.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add src/shared
git commit -m "feat: define extension message protocol"
```

---

### Task 3: Implement Chrome Storage Adapter

**Files:**
- Create: `src/background/storage.ts`
- Test: `src/background/storage.test.ts`

**Step 1: Write failing tests**

Create `src/background/storage.test.ts` with a fake Chrome storage implementation:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStorageAdapter } from "./storage";

const state = new Map<string, unknown>();

beforeEach(() => {
  state.clear();
});

describe("createStorageAdapter", () => {
  it("saves and loads settings from local storage", async () => {
    const storage = createStorageAdapter(fakeChromeStorage());

    await storage.saveSettings({
      baseUrl: "https://nas.local:5001",
      username: "user",
      password: "pass"
    });

    await expect(storage.getSettings()).resolves.toEqual({
      baseUrl: "https://nas.local:5001",
      username: "user",
      password: "pass"
    });
  });

  it("stores session in session storage", async () => {
    const storage = createStorageAdapter(fakeChromeStorage());

    await storage.saveSession({ sid: "abc", createdAt: 123 });

    await expect(storage.getSession()).resolves.toEqual({ sid: "abc", createdAt: 123 });
  });
});

function fakeChromeStorage() {
  return {
    local: area(),
    session: area()
  } as unknown as chrome.storage.StorageAreaAccessors;
}

function area() {
  return {
    get: vi.fn(async (key: string) => ({ [key]: state.get(key) })),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.entries(items).forEach(([key, value]) => state.set(key, value));
    }),
    remove: vi.fn(async (key: string) => {
      state.delete(key);
    })
  };
}
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/background/storage.test.ts`

Expected: FAIL because `storage.ts` does not exist.

**Step 3: Implement adapter**

Create `src/background/storage.ts`:

```ts
import type { ConnectionSettings, SessionState } from "../shared/types";

const SETTINGS_KEY = "connectionSettings";
const SESSION_KEY = "downloadStationSession";

type StorageRoot = Pick<typeof chrome.storage, "local" | "session">;

export function createStorageAdapter(storage: StorageRoot) {
  return {
    async getSettings(): Promise<ConnectionSettings | null> {
      const result = await storage.local.get(SETTINGS_KEY);
      return (result[SETTINGS_KEY] as ConnectionSettings | undefined) ?? null;
    },

    async saveSettings(settings: ConnectionSettings): Promise<void> {
      await storage.local.set({ [SETTINGS_KEY]: settings });
    },

    async getSession(): Promise<SessionState | null> {
      const result = await storage.session.get(SESSION_KEY);
      return (result[SESSION_KEY] as SessionState | undefined) ?? null;
    },

    async saveSession(session: SessionState): Promise<void> {
      await storage.session.set({ [SESSION_KEY]: session });
    },

    async clearSession(): Promise<void> {
      await storage.session.remove(SESSION_KEY);
    }
  };
}
```

**Step 4: Run tests**

Run: `npm test -- src/background/storage.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/background/storage.ts src/background/storage.test.ts
git commit -m "feat: persist extension settings and session"
```

---

### Task 4: Implement Synology API Client

**Files:**
- Create: `src/background/synologyClient.ts`
- Test: `src/background/synologyClient.test.ts`

**Step 1: Write failing tests**

Create tests for login, task listing, and task creation using a fake `fetch`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createSynologyClient } from "./synologyClient";

describe("createSynologyClient", () => {
  it("logs in and returns a sid", async () => {
    const fetcher = vi.fn(async () => json({ success: true, data: { sid: "SID123" } }));
    const client = createSynologyClient("https://nas.local:5001", fetcher);

    await expect(client.login("user", "pass")).resolves.toEqual({ sid: "SID123", createdAt: expect.any(Number) });
  });

  it("normalizes task list responses", async () => {
    const fetcher = vi.fn(async () =>
      json({
        success: true,
        data: {
          tasks: [
            {
              id: "dbid_1",
              title: "ubuntu.iso",
              status: "downloading",
              additional: {
                detail: { total_size: 1000 },
                transfer: { size_downloaded: 250, speed_download: 10, speed_upload: 2 }
              }
            }
          ]
        }
      })
    );
    const client = createSynologyClient("https://nas.local:5001", fetcher);

    await expect(client.listTasks("SID123")).resolves.toEqual([
      {
        id: "dbid_1",
        title: "ubuntu.iso",
        status: "downloading",
        progress: 25,
        downloadedBytes: 250,
        totalBytes: 1000,
        downloadSpeed: 10,
        uploadSpeed: 2
      }
    ]);
  });

  it("creates tasks from multiple URIs", async () => {
    const fetcher = vi.fn(async () => json({ success: true }));
    const client = createSynologyClient("https://nas.local:5001", fetcher);

    await expect(client.createDownload("SID123", ["https://example.com/file.iso"])).resolves.toEqual({ created: 1 });
  });
});

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" }
  });
}
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/background/synologyClient.test.ts`

Expected: FAIL because `synologyClient.ts` does not exist.

**Step 3: Implement client**

Create `src/background/synologyClient.ts` with:

- `createSynologyClient(baseUrl, fetcher = fetch)`
- `login(username, password)`
- `logout(sid)`
- `listTasks(sid)`
- `createDownload(sid, uris, destination?)`
- `normalizeSynologyError(error)`
- `normalizeTask(rawTask)`

Implementation details:

```ts
const AUTH_PATH = "/webapi/auth.cgi";
const TASK_PATH = "/webapi/DownloadStation/task.cgi";

function endpoint(baseUrl: string, path: string, params: Record<string, string | number>): string {
  const url = new URL(path, normalizeBaseUrl(baseUrl));
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return url.toString();
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
```

Use `encodeURIComponent` through `URLSearchParams`; do not manually concatenate user input.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/background/synologyClient.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/background/synologyClient.ts src/background/synologyClient.test.ts
git commit -m "feat: add synology download station client"
```

---

### Task 5: Add Session Manager With Retry

**Files:**
- Create: `src/background/sessionManager.ts`
- Test: `src/background/sessionManager.test.ts`

**Step 1: Write failing tests**

Create tests that verify:

- Existing SID is reused.
- Missing SID triggers login.
- Auth failure during `listTasks` clears the SID, logs in once, and retries.
- Failed login returns a normalized error.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/background/sessionManager.test.ts`

Expected: FAIL because session manager does not exist.

**Step 3: Implement session manager**

Create a factory:

```ts
export function createSessionManager(deps: {
  storage: StorageAdapter;
  clientFactory: (baseUrl: string) => SynologyClient;
  now?: () => number;
}) {
  return {
    connect,
    disconnect,
    listTasks,
    createDownload
  };
}
```

Core behavior:

- `connect()` reads settings, logs in, saves `{ sid, createdAt }`.
- `listTasks()` calls `withSession((client, sid) => client.listTasks(sid))`.
- `createDownload()` calls `withSession((client, sid) => client.createDownload(sid, uris, destination))`.
- `withSession()` retries exactly once if the error code is an auth/session-expired code.

**Step 4: Run tests**

Run: `npm test -- src/background/sessionManager.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/background/sessionManager.ts src/background/sessionManager.test.ts
git commit -m "feat: maintain synology session"
```

---

### Task 6: Wire Background Message Handler

**Files:**
- Modify: `src/background/index.ts`
- Create: `src/background/messageHandler.ts`
- Test: `src/background/messageHandler.test.ts`

**Step 1: Write failing tests**

Create tests that verify each `ExtensionRequest` routes to the right storage/session method and returns `{ ok: true, data }` or `{ ok: false, error }`.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/background/messageHandler.test.ts`

Expected: FAIL because handler does not exist.

**Step 3: Implement message handler**

Create `src/background/messageHandler.ts`:

```ts
export function createMessageHandler(deps: {
  storage: StorageAdapter;
  session: SessionManager;
}) {
  return async function handleMessage(request: unknown) {
    if (!isExtensionRequest(request)) {
      return { ok: false, error: { code: "invalid_request", message: "Unsupported request.", retryable: false } };
    }

    switch (request.type) {
      case "settings.get":
        return ok(await deps.storage.getSettings());
      case "settings.save":
        await deps.storage.saveSettings(request.settings);
        return ok(null);
      case "session.connect":
        await deps.session.connect();
        return ok(null);
      case "session.disconnect":
        await deps.session.disconnect();
        return ok(null);
      case "tasks.list":
        return ok(await deps.session.listTasks());
      case "downloads.create":
        return ok(await deps.session.createDownload(request.uris, request.destination));
    }
  };
}
```

**Step 4: Wire Chrome runtime**

Modify `src/background/index.ts`:

```ts
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  handleMessage(request).then(sendResponse);
  return true;
});
```

**Step 5: Run tests**

Run: `npm test -- src/background/messageHandler.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add src/background/index.ts src/background/messageHandler.ts src/background/messageHandler.test.ts
git commit -m "feat: route extension background messages"
```

---

### Task 7: Build Popup Setup Screen

**Files:**
- Create: `src/popup/api.ts`
- Modify: `src/popup/App.tsx`
- Create: `src/popup/App.test.tsx`
- Create: `src/popup/styles.css`
- Modify: `src/main.tsx`

**Step 1: Write failing UI tests**

Create tests that verify:

- Setup form renders when settings are missing.
- Clicking save sends `settings.save` then `session.connect`.
- Invalid base URL shows client-side validation.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/popup/App.test.tsx`

Expected: FAIL because setup behavior is not implemented.

**Step 3: Implement popup API wrapper**

Create `src/popup/api.ts`:

```ts
import type { ExtensionRequest, ExtensionResponse, ExtensionResponseMap } from "../shared/messages";

export async function sendMessage<T extends ExtensionRequest["type"]>(
  request: Extract<ExtensionRequest, { type: T }>
): Promise<ExtensionResponse<ExtensionResponseMap[T]>> {
  return chrome.runtime.sendMessage(request);
}
```

**Step 4: Implement setup screen**

Modify `src/popup/App.tsx` to load settings on mount, render setup form when missing, validate URL with `new URL(value)`, and call background messages on save.

**Step 5: Add styles**

Create `src/popup/styles.css` with fixed popup width around `360px`, compact form controls, clear status text, and no decorative landing page.

**Step 6: Run tests**

Run: `npm test -- src/popup/App.test.tsx`

Expected: PASS.

**Step 7: Commit**

```bash
git add src/popup src/main.tsx
git commit -m "feat: add connection setup popup"
```

---

### Task 8: Build Task List UI

**Files:**
- Modify: `src/popup/App.tsx`
- Create: `src/popup/TaskList.tsx`
- Create: `src/popup/TaskList.test.tsx`

**Step 1: Write failing tests**

Create tests that verify:

- Loading state appears while tasks are fetched.
- Tasks render title, status, progress, size, and speed.
- Refresh button sends `tasks.list`.
- Session error returns user to setup screen.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/popup/TaskList.test.tsx`

Expected: FAIL because `TaskList` does not exist.

**Step 3: Implement `TaskList`**

Create `src/popup/TaskList.tsx` with props:

```ts
type TaskListProps = {
  tasks: DownloadTask[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onAddClick: () => void;
};
```

Format bytes and speeds locally:

```ts
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
```

**Step 4: Integrate into app**

Modify `App.tsx` to fetch tasks after successful setup and on refresh.

**Step 5: Run tests**

Run: `npm test -- src/popup/TaskList.test.tsx src/popup/App.test.tsx`

Expected: PASS.

**Step 6: Commit**

```bash
git add src/popup/App.tsx src/popup/TaskList.tsx src/popup/TaskList.test.tsx
git commit -m "feat: show download station tasks"
```

---

### Task 9: Build Add Download Flow

**Files:**
- Modify: `src/popup/App.tsx`
- Create: `src/popup/AddDownload.tsx`
- Create: `src/popup/AddDownload.test.tsx`

**Step 1: Write failing tests**

Create tests that verify:

- Add form accepts newline-separated URLs.
- Empty input disables submit.
- Invalid URL or non-magnet input shows validation.
- Successful create refreshes the task list.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/popup/AddDownload.test.tsx`

Expected: FAIL because `AddDownload` does not exist.

**Step 3: Implement URI parsing**

In `src/popup/AddDownload.tsx`, parse input with:

```ts
export function parseDownloadUris(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isSupportedDownloadUri(value: string): boolean {
  if (value.startsWith("magnet:?")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "ftp:";
  } catch {
    return false;
  }
}
```

**Step 4: Implement add form**

Create a compact form with textarea, optional destination input, cancel button, and submit button. On submit, call `downloads.create`, then call parent `onCreated`.

**Step 5: Run tests**

Run: `npm test -- src/popup/AddDownload.test.tsx src/popup/App.test.tsx`

Expected: PASS.

**Step 6: Commit**

```bash
git add src/popup/App.tsx src/popup/AddDownload.tsx src/popup/AddDownload.test.tsx
git commit -m "feat: add download creation flow"
```

---

### Task 10: Add Security and Permissions Hardening

**Files:**
- Modify: `public/manifest.json`
- Modify: `src/background/synologyClient.ts`
- Modify: `src/background/storage.ts`
- Create: `docs/security.md`

**Step 1: Review host permissions**

Keep broad `host_permissions` only if Chrome requires dynamic NAS hosts for user-entered base URLs. Document why the extension needs access to arbitrary HTTP(S) hosts.

**Step 2: Add base URL normalization tests**

Add tests to `src/background/synologyClient.test.ts` for:

- Rejecting non-HTTP(S) base URLs.
- Removing trailing path segments or documenting that paths are unsupported.
- Preventing credentials in base URLs.

**Step 3: Implement URL validation**

Add:

```ts
export function validateBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS DSM URLs are supported.");
  }
  if (url.username || url.password) {
    throw new Error("Do not include credentials in the DSM URL.");
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
```

**Step 4: Write security notes**

Create `docs/security.md` explaining:

- Credentials are stored in Chrome local extension storage.
- SID is stored in session storage and cleared on logout.
- Prefer HTTPS DSM endpoints.
- The extension does not proxy traffic through any third-party service.

**Step 5: Run tests and build**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

**Step 6: Commit**

```bash
git add public/manifest.json src/background/synologyClient.ts src/background/storage.ts docs/security.md
git commit -m "chore: harden extension configuration"
```

---

### Task 11: Add Extension Smoke Test Checklist

**Files:**
- Create: `tests/manual/chrome-extension-smoke.md`
- Create: `playwright.config.ts`
- Create: `tests/e2e/popup.spec.ts`

**Step 1: Add manual smoke checklist**

Create `tests/manual/chrome-extension-smoke.md`:

```markdown
# Chrome Extension Smoke Test

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Load unpacked extension from `H:\Work\dsdn\dist`.
5. Open the extension popup.
6. Enter DSM base URL, username, and password.
7. Click connect.
8. Verify the current Download Station task list appears.
9. Add a known test URL or magnet link.
10. Verify the new task appears after refresh.
11. Close and reopen the popup.
12. Verify the session is reused without re-entering credentials.
```

**Step 2: Add Playwright config**

Create `playwright.config.ts` for Chromium extension testing and a smoke test that loads `dist`.

**Step 3: Add popup smoke test**

Create `tests/e2e/popup.spec.ts` that verifies the popup opens and setup form renders. Do not require a real NAS in automated e2e tests.

**Step 4: Run smoke test locally**

Run: `npm run build`

Expected: PASS.

Run: `npx playwright test`

Expected: PASS for setup-form smoke test.

**Step 5: Commit**

```bash
git add playwright.config.ts tests
git commit -m "test: add extension smoke checks"
```

---

### Task 12: Final Verification

**Files:**
- Modify only if verification exposes issues.

**Step 1: Run full test suite**

Run: `npm test`

Expected: PASS.

**Step 2: Run type check**

Run: `npm run lint`

Expected: PASS.

**Step 3: Run production build**

Run: `npm run build`

Expected: PASS and `dist` contains a valid Manifest V3 extension.

**Step 4: Run manual smoke test**

Follow `tests/manual/chrome-extension-smoke.md` against a real Synology NAS.

Expected: setup connects, task list loads, adding a URL creates a task, popup reopen reuses the session.

**Step 5: Commit fixes if needed**

```bash
git add .
git commit -m "fix: address extension verification issues"
```

Skip if no fixes were needed.

---

## Completion Criteria

- Extension can be loaded from `dist` as an unpacked Chrome extension.
- User can save DSM connection settings.
- Extension logs into Download Station and stores the SID in session storage.
- Popup displays current Download Station tasks.
- Popup can create new downloads from URL or magnet input.
- Expired sessions are refreshed automatically once.
- Automated unit tests cover message protocol, storage, API client, session manager, and popup UI.
- Manual smoke test against a real NAS passes.

## Open Questions Before Implementation

- Should the extension store the DSM password permanently, or should it require re-entry when Chrome restarts?
- Should HTTP be allowed for LAN-only DSM URLs, or should the UI warn every time HTTP is used?
- Should the first version support torrent file upload, or keep it URL/magnet only?
- Should destination folders be free text, or should the extension query Download Station for valid destinations later?

