import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

export async function launchExtension(extensionPath, options = {}) {
  const profile = await mkdtemp(path.join(os.tmpdir(), "spice-chrome-test-"));
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    ignoreDefaultArgs: ["--disable-extensions"],
    viewport: options.viewport ?? { width: 1440, height: 1000 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-first-run",
      "--disable-component-update",
    ],
  });
  return {
    context,
    async close() {
      await context.close();
      await rm(profile, { recursive: true, force: true });
    },
  };
}

export function extensionIdFromUrl(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "chrome-extension:") {
    throw new Error(`expected extension URL, received ${url}`);
  }
  return parsed.hostname;
}
