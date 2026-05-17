import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function syncManifestVersion({ root = rootDir, check = false } = {}) {
  const packagePath = path.join(root, "package.json");
  const manifestPath = path.join(root, "public", "manifest.json");
  const packageJson = await readJson(packagePath);
  const manifestJson = await readJson(manifestPath);

  if (manifestJson.version === packageJson.version) {
    return { changed: false, version: packageJson.version };
  }

  if (check) {
    throw new Error(`Manifest version ${manifestJson.version} does not match package version ${packageJson.version}.`);
  }

  manifestJson.version = packageJson.version;
  await writeFile(manifestPath, `${JSON.stringify(manifestJson, null, 2)}\n`);
  return { changed: true, version: packageJson.version };
}

async function main() {
  const check = process.argv.includes("--check");
  const result = await syncManifestVersion({ check });
  const action = check ? "checked" : result.changed ? "updated" : "already in sync";
  console.log(`Manifest version ${action}: ${result.version}`);
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
