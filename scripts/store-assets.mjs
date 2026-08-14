import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extensionIdFromUrl,
  launchExtension,
} from "../tests/browser/launch.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionPath = path.join(root, "build", "unpacked");
const assets = path.join(root, "store", "assets");
const fixture = await readFile(
  path.join(root, "tests", "fixtures", "github-file.html"),
  "utf8",
);
const logo = await readFile(
  path.join(root, "extension", "assets", "logo-128.png"),
);
const productScreenshot = await readFile(
  path.join(root, "docs", "images", "spice-for-github.png"),
);
const logoUrl = `data:image/png;base64,${logo.toString("base64")}`;
const productScreenshotUrl = `data:image/png;base64,${productScreenshot.toString("base64")}`;

await mkdir(assets, { recursive: true });

const browser = await launchExtension(extensionPath, {
  viewport: { width: 1280, height: 800 },
});

try {
  await browser.context.route("https://github.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: fixture,
    });
  });

  const github =
    browser.context.pages()[0] ?? (await browser.context.newPage());
  await github.goto(
    "https://github.com/spice-framework/chrome/blob/main/examples/demo.go",
    { waitUntil: "domcontentloaded" },
  );
  const indicator = github.locator(".spice-file-indicator");
  await indicator.waitFor();

  const extensionLogoUrl = await indicator.locator("img").getAttribute("src");
  const extensionId = extensionIdFromUrl(extensionLogoUrl);
  const settings = await browser.context.newPage();
  await settings.goto(`chrome-extension://${extensionId}/options.html`);
  await settings.locator("#color-grid .color-field").first().waitFor();
  await settings.screenshot({
    path: path.join(assets, "screenshot-settings-dark-1280x800.png"),
  });

  const product = await browser.context.newPage();
  await product.setContent(`<!doctype html>
    <html><head><style>
      html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #fff; }
      img { display: block; width: 1280px; height: auto; }
    </style></head><body><img src="${productScreenshotUrl}" alt=""></body></html>`);
  await product.locator("img").waitFor();
  await product.screenshot({
    path: path.join(assets, "screenshot-github-native-1280x800.png"),
  });

  const promo = await browser.context.newPage();
  await promo.setViewportSize({ width: 440, height: 280 });
  await promo.setContent(promoDocument({ logoUrl, format: "small" }));
  await promo.screenshot({
    path: path.join(assets, "promo-small-440x280.png"),
  });

  await promo.setViewportSize({ width: 1400, height: 560 });
  await promo.setContent(promoDocument({ logoUrl, format: "marquee" }));
  await promo.screenshot({
    path: path.join(assets, "promo-marquee-1400x560.png"),
  });

  console.log(`Generated Chrome Web Store artwork in ${assets}`);
} finally {
  await browser.close();
}

function promoDocument({ logoUrl, format }) {
  const isSmall = format === "small";
  const sample = isSmall
    ? ""
    : `<div class="code" aria-hidden="true">
        <div><span class="line">01</span><span class="keyword">package</span> main</div>
        <div class="blank"><span class="line">02</span></div>
        <div><span class="line">03</span><span class="annotation">@Application</span></div>
        <div><span class="line">04</span><span class="namespace">@management.</span><span class="annotation">Enable</span><span class="punctuation">(</span><span class="parameter">expose</span><span class="punctuation">=[</span><span class="string">&quot;health&quot;</span><span class="punctuation">])</span></div>
        <div><span class="line">05</span><span class="keyword">func</span> main<span class="punctuation">() {}</span></div>
      </div>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; }
      html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #f6eeef;
        background:
          radial-gradient(circle at 18% 10%, rgb(226 1 20 / 38%), transparent 34%),
          radial-gradient(circle at 88% 92%, rgb(120 8 16 / 30%), transparent 36%),
          linear-gradient(145deg, #16090b, #070506 62%);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .shell {
        display: grid;
        grid-template-columns: ${isSmall ? "1fr" : "minmax(0, 0.88fr) minmax(520px, 1.12fr)"};
        align-items: center;
        gap: ${isSmall ? "0" : "78px"};
        width: 100%;
        padding: ${isSmall ? "30px 34px" : "72px 100px"};
      }
      .identity { display: flex; align-items: center; gap: ${isSmall ? "18px" : "32px"}; }
      .logo {
        width: ${isSmall ? "76px" : "142px"};
        height: ${isSmall ? "76px" : "142px"};
        padding: ${isSmall ? "6px" : "10px"};
        background: #14080a;
        border: 1px solid #5a1018;
        border-radius: ${isSmall ? "20px" : "34px"};
        box-shadow: 0 22px 70px rgb(226 1 20 / 28%);
      }
      .eyebrow { margin: 0 0 ${isSmall ? "5px" : "12px"}; color: #f44752; font-size: ${isSmall ? "10px" : "17px"}; font-weight: 800; letter-spacing: .16em; }
      h1 { margin: 0; font-size: ${isSmall ? "30px" : "59px"}; line-height: .98; letter-spacing: -.045em; }
      .tagline { margin: ${isSmall ? "11px 0 0" : "20px 0 0"}; color: #b7a8aa; font-size: ${isSmall ? "14px" : "24px"}; line-height: 1.35; }
      .proof { margin-top: ${isSmall ? "17px" : "30px"}; color: #ff9aa0; font-size: ${isSmall ? "11px" : "16px"}; font-weight: 700; letter-spacing: .04em; }
      .code {
        padding: 34px 38px;
        color: #f0f6fc;
        background: rgb(13 17 23 / 93%);
        border: 1px solid #3d4651;
        border-radius: 22px;
        box-shadow: 0 32px 90px rgb(0 0 0 / 42%);
        font: 20px/1.9 "Cascadia Code", "SFMono-Regular", Consolas, monospace;
        white-space: nowrap;
      }
      .line { display: inline-block; width: 46px; color: #56606c; user-select: none; }
      .blank { height: 38px; }
      .keyword { color: #ff7b72; }
      .annotation { color: #d2a8ff; }
      .namespace { color: #f0f6fc; }
      .parameter { color: #79c0ff; }
      .string { color: #a5d6ff; }
      .punctuation { color: #f0f6fc; }
    </style>
  </head>
  <body>
    <main class="shell">
      <section>
        <div class="identity">
          <img class="logo" src="${logoUrl}" alt="">
          <div><p class="eyebrow">SPICE FOR GITHUB</p><h1>Native-looking<br>Spice code.</h1></div>
        </div>
        <p class="tagline">Canonical Go source. First-class presentation.</p>
        <p class="proof">VALID GO&nbsp;&nbsp;•&nbsp;&nbsp;LOCAL ONLY&nbsp;&nbsp;•&nbsp;&nbsp;MANIFEST V3</p>
      </section>
      ${sample}
    </main>
  </body>
</html>`;
}
