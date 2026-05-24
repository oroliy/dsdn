import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function verifyReleaseTag({ packageVersion, refName }) {
  const expectedTag = `v${packageVersion}`;
  if (refName !== expectedTag) {
    throw new Error(`Release tag ${refName} does not match package version ${packageVersion}.`);
  }
  return packageVersion;
}

export async function readPackageVersion(root = rootDir) {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  return packageJson.version;
}

async function main() {
  const packageVersion = await readPackageVersion();
  const refName = process.env.GITHUB_REF_NAME || process.argv[2];
  if (!refName) {
    throw new Error("Release tag is required. Set GITHUB_REF_NAME or pass the tag as the first argument.");
  }

  verifyReleaseTag({ packageVersion, refName });
  console.log(`Release tag verified: ${refName}`);
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
