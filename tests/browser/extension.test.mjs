import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extensionIdFromUrl, launchExtension } from "./launch.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const extensionPath = path.join(root, "build", "unpacked");
const fixture = await readFile(
  path.join(root, "tests", "fixtures", "github-file.html"),
  "utf8",
);
const diffFixture = await readFile(
  path.join(root, "tests", "fixtures", "github-diff.html"),
  "utf8",
);
const artifacts = path.join(root, "artifacts", "browser");
await mkdir(artifacts, { recursive: true });

const browser = await launchExtension(extensionPath);
try {
  await browser.context.route("https://github.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: route.request().url().includes("/pull/") ? diffFixture : fixture,
    });
  });
  const page = browser.context.pages()[0] ?? (await browser.context.newPage());
  await page.goto(
    "https://github.com/spice-framework/petclinic/blob/main/main.go",
    { waitUntil: "domcontentloaded" },
  );

  const badge = page.locator(".spice-file-badge");
  await badge.waitFor();
  assert.equal(await badge.textContent(), "Spice file");
  assert.match(await badge.getAttribute("title"), /4 annotations/);
  assert.equal(await badge.locator("img").getAttribute("width"), "16");
  assert.equal(await page.locator(".spice-file-badge").count(), 1);

  const canonicalSources = [
    '// @import { Application } from "github.com/spice-framework/spice/pkg/app"',
    "// @Application",
    '// @management.Enable(expose=["health"], access="loopback", retries=-1)',
    "// @Implements(payments.Processor, health.Checker)",
  ];
  for (let lineNumber = 3; lineNumber <= 6; lineNumber += 1) {
    assert.equal(
      await page.locator(`#LC${lineNumber}`).textContent(),
      canonicalSources[lineNumber - 3],
    );
    assert.equal(
      await page
        .locator(`#LC${lineNumber}`)
        .getAttribute("data-spice-rendered"),
      canonicalSources[lineNumber - 3],
    );
  }
  assert.equal(
    await page.locator("#LC7").getAttribute("data-spice-rendered"),
    null,
  );
  assert.equal(
    await page.locator("#LC8").getAttribute("data-spice-rendered"),
    null,
  );

  assert.equal(
    await page.locator('#LC5 [data-spice-token="NAMESPACE"]').textContent(),
    "management",
  );
  assert.equal(
    await page.locator('#LC5 [data-spice-token="ANNOTATION"]').textContent(),
    "Enable",
  );
  assert.deepEqual(
    await page.locator('#LC5 [data-spice-token="PARAMETER"]').allTextContents(),
    ["expose", "access", "retries"],
  );
  assert.deepEqual(
    await page
      .locator('#LC6 [data-spice-token="TYPE_REFERENCE"]')
      .allTextContents(),
    ["Processor", "Checker"],
  );
  assert.equal(
    await page
      .locator("#LC4 .spice-source-prefix")
      .evaluate((element) => getComputedStyle(element).fontSize),
    "0px",
  );
  assert.equal(
    await page.locator("#LC4").evaluate((line) => {
      const selection = getSelection();
      const range = document.createRange();
      range.selectNodeContents(line);
      selection.removeAllRanges();
      selection.addRange(range);
      const selected = selection.toString();
      selection.removeAllRanges();
      return selected;
    }),
    "// @Application",
  );
  assert.match(
    await page
      .locator('[data-testid="read-only-cursor-text-area"]')
      .inputValue(),
    /\/\/ @Application/,
  );

  await page.evaluate(() => {
    const line = document.createElement("div");
    line.id = "LC10";
    line.className = "react-file-line";
    line.textContent = "// @Bean";
    document.querySelector(".react-code-lines").append(line);
  });
  await page.locator('#LC10 [data-spice-token="ANNOTATION"]').waitFor();
  await page.waitForFunction(() =>
    document
      .querySelector(".spice-file-badge")
      ?.title.includes("5 annotations"),
  );
  assert.equal(await page.locator(".spice-file-badge").count(), 1);

  const logoUrl = await badge.locator("img").getAttribute("src");
  const extensionId = extensionIdFromUrl(logoUrl);
  const options = await browser.context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator("#color-grid .color-field").first().waitFor();
  assert.equal(await options.locator("#color-grid .color-field").count(), 15);
  await options.locator('input[name="theme"][value="custom"]').check();
  await options.locator('[data-color-text="annotation"]').fill("#00ff88");
  await options
    .locator('[data-color-text="annotation"]')
    .dispatchEvent("input");
  await options.locator('button[type="submit"]').click();
  await page.waitForFunction(() =>
    document.documentElement.classList.contains("spice-custom-theme"),
  );
  assert.equal(
    await page
      .locator('#LC4 [data-spice-token="ANNOTATION"]')
      .evaluate((element) => getComputedStyle(element).color),
    "rgb(0, 255, 136)",
  );

  await options.locator("#conceal-prefix").uncheck();
  await options.locator('button[type="submit"]').click();
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("spice-conceal-prefix"),
  );
  assert.equal(
    await page
      .locator("#LC4 .spice-source-prefix")
      .evaluate((element) => getComputedStyle(element).fontSize),
    "14px",
  );

  await page.goto("https://github.com/spice-framework/petclinic/pull/1/files", {
    waitUntil: "domcontentloaded",
  });
  await page.locator('#diff-go [data-spice-token="ANNOTATION"]').waitFor();
  assert.equal(await page.locator(".spice-file-badge").count(), 1);
  assert.equal(
    await page.locator('[data-path="main.go"] .spice-file-badge').textContent(),
    "Spice file",
  );
  assert.equal(
    await page.locator('[data-path="README.md"] .spice-file-badge').count(),
    0,
  );
  assert.equal(await page.locator("#diff-go").textContent(), "// @Application");
  assert.equal(
    await page.locator("#diff-comment").getAttribute("data-spice-rendered"),
    null,
  );
  assert.equal(
    await page.locator("#diff-markdown").getAttribute("data-spice-rendered"),
    null,
  );

  await page.screenshot({
    path: path.join(artifacts, "fixture.png"),
    fullPage: true,
  });
  await options.screenshot({
    path: path.join(artifacts, "options.png"),
    fullPage: true,
  });
  console.log(
    "Browser extension test passed: rendering, source integrity, badge, SPA updates, and options.",
  );
} finally {
  await browser.close();
}
