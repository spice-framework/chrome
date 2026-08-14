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
const markdownFixture = await readFile(
  path.join(root, "tests", "fixtures", "github-markdown.html"),
  "utf8",
);
const blameFixture = await readFile(
  path.join(root, "tests", "fixtures", "github-blame.html"),
  "utf8",
);
const artifacts = path.join(root, "artifacts", "browser");
await mkdir(artifacts, { recursive: true });

const browser = await launchExtension(extensionPath);
try {
  await browser.context.route("https://github.com/**", async (route) => {
    const url = route.request().url();
    let body = fixture;
    if (url.includes("/pull/")) {
      body = diffFixture;
    } else if (url.includes("/blame/")) {
      body = blameFixture;
    } else if (url.includes(".md")) {
      body = markdownFixture;
    }
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body,
    });
  });
  const page = browser.context.pages()[0] ?? (await browser.context.newPage());
  await page.goto(
    "https://github.com/spice-framework/petclinic/blob/main/main.go",
    { waitUntil: "domcontentloaded" },
  );

  const indicator = page.locator(".spice-file-indicator");
  await indicator.waitFor();
  assert.equal(await indicator.textContent(), "");
  assert.match(await indicator.getAttribute("title"), /4 declarations/);
  assert.equal(await indicator.locator("img").getAttribute("width"), "16");
  assert.equal(
    await indicator.getAttribute("aria-label"),
    await indicator.getAttribute("title"),
  );
  assert.equal(
    await indicator.getAttribute("href"),
    "https://github.com/spice-framework/spice",
  );
  assert.equal(await indicator.getAttribute("target"), "_blank");
  assert.equal(await page.locator(".spice-file-indicator").count(), 1);
  assert.equal(await page.locator(".spice-file-badge").count(), 0);
  assert.equal(
    await page.locator(".spice-view-breadcrumb code").textContent(),
    "src/main/go/PetclinicApplication.go",
  );
  assert.equal(
    await page.locator("html").getAttribute("data-spice-view-category"),
    "Source",
  );
  assert.equal(
    await indicator.evaluate(
      (element) => element.nextElementSibling?.dataset.testid,
    ),
    "more-file-actions-button-nav-menu-wide",
  );

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
      .locator('#LC5 [data-spice-token="NAMESPACE"]')
      .evaluate((element) => getComputedStyle(element).color),
    "rgb(240, 246, 252)",
  );
  assert.equal(
    await page
      .locator('#LC5 [data-spice-token="ANNOTATION"]')
      .evaluate((element) => getComputedStyle(element).color),
    "rgb(210, 168, 255)",
  );
  assert.notEqual(
    await page
      .locator('#LC5 [data-spice-token="ANNOTATION"]')
      .evaluate((element) => getComputedStyle(element).fontWeight),
    "600",
  );
  assert.deepEqual(
    await page.locator("html").evaluate((element) => ({
      vivid: element.classList.contains("spice-vivid-theme"),
      custom: element.classList.contains("spice-custom-theme"),
    })),
    { vivid: false, custom: false },
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
      .querySelector(".spice-file-indicator")
      ?.title.includes("5 declarations"),
  );
  assert.equal(await page.locator(".spice-file-indicator").count(), 1);

  const linkedPagePromise = browser.context.waitForEvent("page");
  await indicator.click();
  const linkedPage = await linkedPagePromise;
  await linkedPage.waitForLoadState("domcontentloaded");
  assert.equal(new URL(linkedPage.url()).pathname, "/spice-framework/spice");
  await linkedPage.close();

  const logoUrl = await indicator.locator("img").getAttribute("src");
  const extensionId = extensionIdFromUrl(logoUrl);
  const options = await browser.context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator("#color-grid .color-field").first().waitFor();
  assert.equal(await options.locator("#color-grid .color-field").count(), 14);
  assert.equal(
    await options.locator('input[name="theme"][value="native"]').isChecked(),
    true,
  );
  assert.equal(
    await options.locator('[data-color-text="annotation"]').isDisabled(),
    true,
  );
  await options.locator('input[name="theme"][value="vivid"]').check();
  await options.locator('button[type="submit"]').click();
  await page.waitForFunction(() =>
    document.documentElement.classList.contains("spice-vivid-theme"),
  );
  assert.equal(
    await page
      .locator('#LC5 [data-spice-token="PARAMETER"]')
      .first()
      .evaluate((element) => getComputedStyle(element).color),
    "rgb(255, 166, 87)",
  );
  assert.equal(
    await page
      .locator('#LC5 [data-spice-token="ANNOTATION"]')
      .evaluate((element) => getComputedStyle(element).fontWeight),
    "600",
  );
  await options.locator('input[name="theme"][value="custom"]').check();
  assert.equal(
    await options.locator('[data-color-text="annotation"]').isEnabled(),
    true,
  );
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

  await options.locator('input[name="theme"][value="native"]').check();
  await options.locator("#conceal-prefix").check();
  await options.locator('button[type="submit"]').click();
  await page.waitForFunction(
    () =>
      document.documentElement.classList.contains("spice-conceal-prefix") &&
      !document.documentElement.classList.contains("spice-vivid-theme") &&
      !document.documentElement.classList.contains("spice-custom-theme"),
  );

  await page.goto("https://github.com/spice-framework/petclinic/pull/1/files", {
    waitUntil: "domcontentloaded",
  });
  await page.locator('#diff-go [data-spice-token="ANNOTATION"]').waitFor();
  assert.equal(await page.locator(".spice-file-indicator").count(), 4);
  assert.equal(
    await page
      .locator('[data-path="main.go"] .spice-file-indicator')
      .textContent(),
    "",
  );
  assert.equal(
    await page.locator('[data-path="README.md"] .spice-file-indicator').count(),
    1,
  );
  assert.equal(
    await page
      .locator('[data-path="main.go"] .spice-file-indicator')
      .evaluate((element) => element.parentElement?.className),
    "file-actions",
  );
  assert.equal(await page.locator("#diff-go").textContent(), "// @Application");
  assert.equal(
    await page.locator("#diff-comment").getAttribute("data-spice-rendered"),
    null,
  );
  assert.equal(
    await page.locator("#diff-markdown").getAttribute("data-spice-rendered"),
    "// @Application",
  );
  assert.equal(
    await page
      .locator('#diff-react-go [data-spice-token="ANNOTATION"]')
      .textContent(),
    "Controller",
  );
  assert.equal(
    await page
      .locator('[data-path="owner.go"] .spice-file-indicator')
      .evaluate((element) => element.parentElement?.dataset.testid),
    "file-header-actions",
  );
  assert.equal(
    await page
      .locator('#diff-text-inner [data-spice-token="ANNOTATION"]')
      .textContent(),
    "Bean",
  );
  assert.equal(
    await page
      .locator('[data-path="main.go"] .spice-view-breadcrumb code')
      .textContent(),
    "src/main/go/PetclinicApplication.go",
  );
  assert.equal(
    await page
      .locator(
        '[data-path="internal/users/user_service_test.go"] .spice-view-breadcrumb code',
      )
      .textContent(),
    "src/test/go/users/application/UserServiceTest.go",
  );
  assert.equal(
    await page
      .locator(
        '[data-path="internal/users/user_service_test.go"] .spice-view-source-link',
      )
      .getAttribute("href"),
    "/spice-framework/petclinic/blob/HEAD/internal/users/user_service.go",
  );
  const generated = page.locator(
    '[data-path="internal/spicegen/petclinic/application.go"]',
  );
  assert.equal(
    await generated.getAttribute("data-spice-view-category"),
    "Generated Sources",
  );
  assert.equal(
    await generated.locator(".spice-view-breadcrumb code").textContent(),
    "build/generated/spice/petclinic/application.go",
  );
  const generatedToggle = generated.locator(".spice-generated-toggle");
  assert.equal(await generatedToggle.getAttribute("aria-expanded"), "true");
  await generatedToggle.click();
  assert.equal(await generatedToggle.getAttribute("aria-expanded"), "false");
  assert.equal(
    await generated.locator("#generated-diff-body").isHidden(),
    true,
  );

  await page.goto(
    "https://github.com/spice-framework/spice/blob/main/docs/getting-started.md",
    { waitUntil: "domcontentloaded" },
  );
  await page
    .locator('#markdown-go-fence [data-spice-token="ANNOTATION"]')
    .first()
    .waitFor();
  assert.match(
    await page.locator("#markdown-go-fence").textContent(),
    /\/\/ @Application/,
  );
  assert.match(
    await page.locator("#markdown-go-fence").textContent(),
    /func main\(\) \{/,
  );
  assert.equal(
    await page.locator("#markdown-prose").getAttribute("data-spice-rendered"),
    null,
  );
  assert.equal(
    await page
      .locator("#markdown-prose")
      .evaluate((element) => Boolean(element.closest("[data-spice-rendered]"))),
    false,
  );
  assert.equal(await page.locator(".spice-file-indicator").count(), 1);
  assert.equal(
    await page.locator("#markdown-go-fence").evaluate((block) => {
      const annotation = block.querySelector('[data-spice-token="ANNOTATION"]');
      const selection = getSelection();
      const range = document.createRange();
      range.selectNodeContents(annotation);
      selection.removeAllRanges();
      selection.addRange(range);
      const selected = selection.toString();
      selection.removeAllRanges();
      return selected;
    }),
    "Application",
  );

  await page.goto(
    "https://github.com/spice-framework/petclinic/blame/main/main.go",
    { waitUntil: "domcontentloaded" },
  );
  await page.locator('#blame-go [data-spice-token="ANNOTATION"]').waitFor();
  assert.equal(
    await page.locator("#blame-go").textContent(),
    "// @Application",
  );
  assert.equal(await page.locator(".spice-file-indicator").count(), 1);

  await page.screenshot({
    path: path.join(artifacts, "fixture.png"),
    fullPage: true,
  });
  await options.screenshot({
    path: path.join(artifacts, "options.png"),
    fullPage: true,
  });
  console.log(
    "Browser extension test passed: native/vivid themes, source integrity, icon link, SPA updates, diffs, and options.",
  );
} finally {
  await browser.close();
}
