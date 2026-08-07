import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchExtension } from "./launch.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const extensionPath = path.join(root, "build", "unpacked");
const artifacts = path.join(root, "artifacts", "browser");
await mkdir(artifacts, { recursive: true });

const browser = await launchExtension(extensionPath);
try {
  const page = browser.context.pages()[0] ?? (await browser.context.newPage());
  await page.goto(
    "https://github.com/spice-framework/petclinic/blob/main/main.go",
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  await page.locator(".spice-file-indicator").waitFor({ timeout: 30_000 });
  const rendered = page.locator('[data-spice-rendered^="// @"]');
  assert(
    (await rendered.count()) > 0,
    "live GitHub page had no rendered Spice lines",
  );
  assert.match(
    await page.locator(".spice-file-indicator").getAttribute("title"),
    /declaration/,
  );
  assert.equal(
    await page.locator(".spice-file-indicator").getAttribute("href"),
    "https://github.com/spice-framework/spice",
  );
  assert.match(
    (await page
      .locator(".spice-file-indicator")
      .evaluate((element) => element.nextElementSibling?.dataset.testid)) ?? "",
    /more-file-actions|raw-button/,
    "indicator was not placed beside the right-side file controls",
  );
  const rawSource = await page
    .locator('[data-testid="read-only-cursor-text-area"]')
    .inputValue();
  assert(
    rawSource.includes("// @Application"),
    "GitHub raw source control was altered",
  );
  assert.equal(
    await page.locator(".spice-file-indicator").count(),
    1,
    "indicator was duplicated",
  );
  await page.screenshot({
    path: path.join(artifacts, "live-github.png"),
    fullPage: true,
  });
  console.log(
    `Live GitHub smoke passed with ${await rendered.count()} Spice declarations.`,
  );
} finally {
  await browser.close();
}
