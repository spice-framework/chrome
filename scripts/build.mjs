import { copyFile, cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "extension");
const build = path.join(root, "build");
const unpacked = path.join(build, "unpacked");

const sourceEntries = await readdir(source);
if (!sourceEntries.includes("manifest.json")) {
  throw new Error(`extension manifest is missing from ${source}`);
}

await rm(build, { recursive: true, force: true });
await mkdir(build, { recursive: true });
await cp(source, unpacked, { recursive: true, force: false });
await copyFile(
  path.join(root, "packages", "spice-syntax", "src", "index.cjs"),
  path.join(unpacked, "spice-syntax.js"),
);
await copyFile(
  path.join(root, "packages", "spice-syntax", "src", "palette.cjs"),
  path.join(unpacked, "settings.js"),
);

console.log(`Built unpacked extension at ${unpacked}`);
