import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const unpacked = path.join(root, "build", "unpacked");
const manifest = JSON.parse(
  await readFile(path.join(unpacked, "manifest.json"), "utf8"),
);
const output = path.join(
  root,
  "build",
  `spice-for-github-v${manifest.version}.zip`,
);
const entries = [];

async function collect(directory, prefix = "") {
  const names = (await readdir(directory)).sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  for (const name of names) {
    const absolute = path.join(directory, name);
    const relative = path.posix.join(prefix, name);
    if ((await stat(absolute)).isDirectory()) {
      await collect(absolute, relative);
    } else {
      entries.push({ name: relative, data: await readFile(absolute) });
    }
  }
}

await collect(unpacked);

const localRecords = [];
const centralRecords = [];
let localOffset = 0;
for (const entry of entries) {
  const name = Buffer.from(entry.name, "utf8");
  const checksum = crc32(entry.data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(0x0021, 12);
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(entry.data.length, 18);
  local.writeUInt32LE(entry.data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  localRecords.push(local, name, entry.data);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(0x0314, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(0x0021, 14);
  central.writeUInt32LE(checksum, 16);
  central.writeUInt32LE(entry.data.length, 20);
  central.writeUInt32LE(entry.data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0o100644 * 0x10000, 38);
  central.writeUInt32LE(localOffset, 42);
  centralRecords.push(central, name);

  localOffset += local.length + name.length + entry.data.length;
}

const centralDirectory = Buffer.concat(centralRecords);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(0, 4);
end.writeUInt16LE(0, 6);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(centralDirectory.length, 12);
end.writeUInt32LE(localOffset, 16);
end.writeUInt16LE(0, 20);

await writeFile(
  output,
  Buffer.concat([...localRecords, centralDirectory, end]),
);
console.log(`Packaged ${entries.length} files at ${output}`);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
