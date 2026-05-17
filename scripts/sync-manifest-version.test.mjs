import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { syncManifestVersion } from "./sync-manifest-version.mjs";

describe("syncManifestVersion", () => {
  it("fails check mode when package and manifest versions differ", async () => {
    const root = await makeProject({ packageVersion: "0.2.0", manifestVersion: "0.1.0" });

    await expect(syncManifestVersion({ root, check: true })).rejects.toThrow("Manifest version 0.1.0 does not match package version 0.2.0.");
  });

  it("updates manifest version from package version", async () => {
    const root = await makeProject({ packageVersion: "0.2.0", manifestVersion: "0.1.0" });

    await expect(syncManifestVersion({ root })).resolves.toEqual({ changed: true, version: "0.2.0" });

    const manifest = JSON.parse(await readFile(path.join(root, "public", "manifest.json"), "utf8"));
    expect(manifest.version).toBe("0.2.0");
  });
});

async function makeProject({ packageVersion, manifestVersion }) {
  const root = await mkdir(path.join(os.tmpdir(), `dsdn-version-${Date.now()}-${Math.random()}`), { recursive: true });
  await mkdir(path.join(root, "public"), { recursive: true });
  await writeFile(path.join(root, "package.json"), JSON.stringify({ version: packageVersion }));
  await writeFile(path.join(root, "public", "manifest.json"), JSON.stringify({ manifest_version: 3, version: manifestVersion }));
  return root;
}
