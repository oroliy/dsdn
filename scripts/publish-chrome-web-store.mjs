import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function requiredConfig(env = process.env) {
  const required = {
    CWS_CLIENT_ID: "clientId",
    CWS_CLIENT_SECRET: "clientSecret",
    CWS_REFRESH_TOKEN: "refreshToken",
    CWS_PUBLISHER_ID: "publisherId",
    CWS_EXTENSION_ID: "extensionId"
  };
  const missing = Object.keys(required).filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing Chrome Web Store secrets: ${missing.join(", ")}.`);
  }
  return Object.fromEntries(Object.entries(required).map(([envName, configName]) => [configName, env[envName]]));
}

export function endpoints({ publisherId, extensionId }) {
  return {
    upload: `https://chromewebstore.googleapis.com/upload/v2/publishers/${publisherId}/items/${extensionId}:upload`,
    publish: `https://chromewebstore.googleapis.com/v2/publishers/${publisherId}/items/${extensionId}:publish`
  };
}

export async function packagePath(root = rootDir) {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  return path.join(root, "release", `synology-download-station-extension-${packageJson.version}.zip`);
}

export async function getAccessToken(config, fetcher = fetch) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: "refresh_token"
  });
  const response = await fetcher(TOKEN_URL, { method: "POST", body });
  const data = await parseJsonResponse(response, "refresh access token");
  if (!data.access_token) {
    throw new Error("Chrome Web Store token response did not include an access token.");
  }
  return data.access_token;
}

export async function uploadAndPublish({ root = rootDir, env = process.env, fetcher = fetch, dryRun = false } = {}) {
  const zipPath = await packagePath(root);
  if (dryRun) {
    const publisherId = env.CWS_PUBLISHER_ID || "<publisher-id>";
    const extensionId = env.CWS_EXTENSION_ID || "<extension-id>";
    return {
      dryRun: true,
      zipPath,
      ...endpoints({ publisherId, extensionId })
    };
  }

  const config = requiredConfig(env);
  const zip = await readFile(zipPath);
  const accessToken = await getAccessToken(config, fetcher);
  const urls = endpoints(config);
  const headers = { Authorization: `Bearer ${accessToken}` };

  await parseJsonResponse(
    await fetcher(urls.upload, {
      method: "POST",
      headers: { ...headers, "content-type": "application/zip" },
      body: zip
    }),
    "upload extension package"
  );

  const publishResult = await parseJsonResponse(
    await fetcher(urls.publish, {
      method: "POST",
      headers
    }),
    "publish extension"
  );

  return { dryRun: false, zipPath, publishResult };
}

async function parseJsonResponse(response, action) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = data.error?.message || data.message || text || `HTTP ${response.status}`;
    throw new Error(`Failed to ${action}: ${message}`);
  }
  return data;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const result = await uploadAndPublish({ dryRun });
  if (result.dryRun) {
    console.log("Chrome Web Store publish dry run");
    console.log(`  package: ${result.zipPath}`);
    console.log(`  upload: ${result.upload}`);
    console.log(`  publish: ${result.publish}`);
    return;
  }
  console.log("Chrome Web Store publish submitted");
  console.log(`  package: ${result.zipPath}`);
  console.log(`  status: ${JSON.stringify(result.publishResult)}`);
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
