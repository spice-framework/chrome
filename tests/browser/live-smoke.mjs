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
  const rendered = page.locator('[data-spice-token="ANNOTATION"]');
  await rendered.first().waitFor({ timeout: 30_000 });
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
  const blobCount = await rendered.count();
  let markdownCount = 0;
  let blameCount = 0;
  let commitCount = 0;

  await page.goto(
    "https://github.com/spice-framework/spice/blob/main/docs/getting-started.md",
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  const markdownRendered = page.locator(
    '.highlight-source-go [data-spice-token="ANNOTATION"]',
  );
  await markdownRendered.first().waitFor({ timeout: 30_000 });
  markdownCount = await markdownRendered.count();
  assert(markdownCount > 0, "live markdown page had no rendered Spice lines");
  assert.match(
    (await page.locator(".highlight-source-go").textContent()) ?? "",
    /func main\(\)/,
    "markdown fence lost surrounding Go source",
  );
  assert.equal(await page.locator(".spice-file-indicator").count(), 1);
  await page.screenshot({
    path: path.join(artifacts, "live-markdown.png"),
    fullPage: true,
  });

  await page.goto(
    "https://github.com/spice-framework/petclinic/blame/main/main.go",
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  const blameRendered = page.locator('[data-spice-token="ANNOTATION"]');
  await blameRendered.first().waitFor({ timeout: 30_000 });
  blameCount = await blameRendered.count();
  assert(blameCount > 0, "live blame page had no rendered Spice lines");
  assert.equal(await page.locator(".spice-file-indicator").count(), 1);

  await page.goto(
    "https://github.com/spice-framework/petclinic/commit/89db4b2c2a098cdf9d24939df550131df12eef6a",
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  await page.locator(".diff-text-inner").first().waitFor({ timeout: 30_000 });
  const commitRendered = page.locator(
    '.diff-text-inner [data-spice-token="ANNOTATION"]',
  );
  await commitRendered.first().waitFor({ timeout: 30_000 });
  commitCount = await commitRendered.count();
  assert(commitCount > 0, "live commit page had no rendered Spice lines");
  await page.screenshot({
    path: path.join(artifacts, "live-diff.png"),
    fullPage: true,
  });

  console.log(
    `Live GitHub smoke passed with ${blobCount} blob, ${markdownCount} markdown, ${blameCount} blame, and ${commitCount} commit Spice tokens.`,
  );
} finally {
  await browser.close();
}
