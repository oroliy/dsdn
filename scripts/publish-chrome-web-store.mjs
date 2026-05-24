import { readFile } from "node:fs/promises";
import { createSign } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CWS_SCOPE = "https://www.googleapis.com/auth/chromewebstore";
export const DEFAULT_EXTENSION_ID = "caffhlhkjmlbmglhmldjfobajeaiaefc";

export function requiredConfig(env = process.env) {
  if (!env.CWS_PUBLISHER_ID) {
    throwMissingAuth();
  }

  if (env.CWS_SERVICE_ACCOUNT_JSON) {
    return {
      authType: "serviceAccount",
      serviceAccount: parseServiceAccountJson(env.CWS_SERVICE_ACCOUNT_JSON),
      publisherId: env.CWS_PUBLISHER_ID,
      extensionId: env.CWS_EXTENSION_ID || DEFAULT_EXTENSION_ID
    };
  }

  if (!env.CWS_CLIENT_ID || !env.CWS_CLIENT_SECRET || !env.CWS_REFRESH_TOKEN) {
    throwMissingAuth();
  }

  return {
    authType: "oauth",
    clientId: env.CWS_CLIENT_ID,
    clientSecret: env.CWS_CLIENT_SECRET,
    refreshToken: env.CWS_REFRESH_TOKEN,
    publisherId: env.CWS_PUBLISHER_ID,
    extensionId: env.CWS_EXTENSION_ID || DEFAULT_EXTENSION_ID
  };
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
  if (config.authType === "serviceAccount") {
    return getServiceAccountAccessToken(config.serviceAccount, fetcher);
  }

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

export async function getServiceAccountAccessToken(serviceAccount, fetcher = fetch, nowSeconds = Math.floor(Date.now() / 1000)) {
  const assertion = createServiceAccountJwt(serviceAccount, nowSeconds);
  const response = await fetcher(TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const data = await parseJsonResponse(response, "exchange service account JWT for access token");
  if (!data.access_token) {
    throw new Error("Chrome Web Store token response did not include an access token.");
  }
  return data.access_token;
}

export function createServiceAccountJwt(serviceAccount, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: CWS_SCOPE,
    aud: TOKEN_URL,
    exp: nowSeconds + 3600,
    iat: nowSeconds
  };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(claim)}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key, "base64url");
  return `${signingInput}.${signature}`;
}

function parseServiceAccountJson(value) {
  try {
    const parsed = JSON.parse(value);
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("missing fields");
    }
    return parsed;
  } catch {
    throw new Error("CWS_SERVICE_ACCOUNT_JSON must be a valid Google service account JSON value.");
  }
}

function throwMissingAuth() {
  throw new Error(
    "Missing Chrome Web Store auth. Configure either CWS_SERVICE_ACCOUNT_JSON or CWS_CLIENT_ID, CWS_CLIENT_SECRET, and CWS_REFRESH_TOKEN. Also configure CWS_PUBLISHER_ID."
  );
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export async function uploadAndPublish({ root = rootDir, env = process.env, fetcher = fetch, dryRun = false } = {}) {
  const zipPath = await packagePath(root);
  if (dryRun) {
    const publisherId = env.CWS_PUBLISHER_ID || "<publisher-id>";
    const extensionId = env.CWS_EXTENSION_ID || DEFAULT_EXTENSION_ID;
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
