import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredAssets = new Map([
  ["screenshot-settings-dark-1280x800.png", [1280, 800]],
  ["screenshot-github-native-1280x800.png", [1280, 800]],
  ["promo-small-440x280.png", [440, 280]],
  ["promo-marquee-1400x560.png", [1400, 560]],
]);

for (const [filename, dimensions] of requiredAssets) {
  const actual = await pngDimensions(
    path.join(root, "store", "assets", filename),
  );
  assert.deepEqual(actual, dimensions, `${filename} has wrong dimensions`);
}

for (const filename of [
  "store/listing.md",
  "docs/privacy.md",
  "docs/releases/v0.1.1.md",
]) {
  const source = await readFile(path.join(root, filename), "utf8");
  assert(source.trim().length > 0, `${filename} is empty`);
  assert(!source.includes("\\n"), `${filename} contains a literal \\n escape`);
}

console.log(
  `Validated Chrome Web Store submission (${requiredAssets.size} correctly sized images).`,
);

async function pngDimensions(filename) {
  const buffer = await readFile(filename);
  assert.equal(
    buffer.toString("hex", 0, 8),
    "89504e470d0a1a0a",
    `${filename} is not PNG`,
  );
  assert.equal(
    buffer.toString("ascii", 12, 16),
    "IHDR",
    `${filename} has no IHDR`,
  );
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}
