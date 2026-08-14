import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extension = path.join(root, "extension");
const syntaxPackage = path.join(root, "packages", "spice-syntax", "src");
const viewPathsPackage = path.join(root, "packages", "spice-view-paths", "src");
const manifest = JSON.parse(
  await readFile(path.join(extension, "manifest.json"), "utf8"),
);
const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);

assert.equal(manifest.manifest_version, 3, "extension must use Manifest V3");
assert.equal(
  manifest.version,
  packageJson.version,
  "manifest/package versions differ",
);
assert.deepEqual(
  manifest.permissions,
  ["storage"],
  "only storage permission is allowed",
);
assert.equal(
  manifest.host_permissions,
  undefined,
  "host_permissions are not needed",
);
assert.deepEqual(
  manifest.content_scripts.map((script) => script.matches),
  [["https://github.com/*"]],
  "content script must be limited to github.com",
);
assert.equal(
  manifest.content_scripts[0].world,
  "ISOLATED",
  "content script must use an isolated world",
);

const expectedFiles = new Set([
  "assets/logo-16.png",
  "assets/logo-32.png",
  "assets/logo-48.png",
  "assets/logo-128.png",
  "content.js",
  "manifest.json",
  "options.css",
  "options.html",
  "options.js",
  "settings.js",
  "spice-syntax.js",
  "spice-view-paths.js",
  "styles.css",
]);
const sourceFiles = await listFiles(extension);
const virtualFiles = new Map([
  ["spice-syntax.js", path.join(syntaxPackage, "index.cjs")],
  ["spice-view-paths.js", path.join(viewPathsPackage, "index.cjs")],
  ["settings.js", path.join(syntaxPackage, "palette.cjs")],
]);
const actualFiles = new Set([...sourceFiles, ...virtualFiles.keys()]);
assert.deepEqual(
  actualFiles,
  expectedFiles,
  "extension file set changed unexpectedly",
);

for (const script of manifest.content_scripts) {
  for (const filename of [...(script.js ?? []), ...(script.css ?? [])]) {
    assert(
      actualFiles.has(filename),
      `manifest references missing ${filename}`,
    );
  }
}
assert(actualFiles.has(manifest.options_ui.page), "options page is missing");

for (const [size, filename] of Object.entries(manifest.icons)) {
  const dimensions = await pngDimensions(path.join(extension, filename));
  assert.deepEqual(
    dimensions,
    [Number(size), Number(size)],
    `${filename} has wrong dimensions`,
  );
}

const executableFiles = [...actualFiles].filter((filename) =>
  /\.(?:html|js)$/.test(filename),
);
for (const filename of executableFiles) {
  const source = await readFile(
    virtualFiles.get(filename) ?? path.join(extension, filename),
    "utf8",
  );
  const remoteUrls = [...source.matchAll(/https?:\/\/[^\s"'`<>)]+/g)].map(
    ([url]) => url,
  );
  assert(!/\beval\s*\(/.test(source), `${filename} uses eval`);
  assert(!/\bnew\s+Function\b/.test(source), `${filename} uses new Function`);
  assert(
    !/<script\b[^>]*>\s*[^<\s]/i.test(source),
    `${filename} has inline script`,
  );
  assert(
    remoteUrls.every(
      (url) => url === "https://github.com/spice-framework/spice",
    ),
    `${filename} contains an unapproved remote URL: ${remoteUrls.join(", ")}`,
  );
}

console.log(
  `Validated Manifest V3 extension (${actualFiles.size} files, least privilege).`,
);

async function listFiles(directory, prefix = "") {
  const output = [];
  const names = (await readdir(directory)).sort();
  for (const name of names) {
    const absolute = path.join(directory, name);
    const relative = path.posix.join(prefix, name);
    if ((await stat(absolute)).isDirectory()) {
      output.push(...(await listFiles(absolute, relative)));
    } else {
      output.push(relative);
    }
  }
  return output;
}

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
