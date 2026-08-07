import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function validateRelease({ tag, manifest, packageJson, notes }) {
  assert.match(tag, /^v\d+\.\d+\.\d+$/, `invalid release tag: ${tag}`);
  assert.equal(
    manifest.version,
    packageJson.version,
    "manifest/package versions differ",
  );
  assert.equal(
    tag,
    `v${manifest.version}`,
    "tag does not match package version",
  );
  assert(notes.trim().length > 0, `release notes for ${tag} are empty`);
  assert(
    !notes.includes("\\n"),
    `release notes for ${tag} contain literal \\n`,
  );
  assert.match(
    notes,
    new RegExp(
      `https://github\\.com/spice-framework/chrome/releases/download/${tag}/spice-for-github-settings-dark\\.png`,
    ),
    `release notes for ${tag} must include the dark settings screenshot`,
  );
}

export async function validateReleaseFiles(tag) {
  const manifest = JSON.parse(
    await readFile(path.join(root, "extension", "manifest.json"), "utf8"),
  );
  const packageJson = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  );
  const notes = await readFile(
    path.join(root, "docs", "releases", `${tag}.md`),
    "utf8",
  );
  validateRelease({ tag, manifest, packageJson, notes });
  console.log(`Validated release metadata for ${tag}.`);
}

const invokedAsScript =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedAsScript) {
  const packageJson = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  );
  await validateReleaseFiles(process.argv[2] ?? `v${packageJson.version}`);
}
