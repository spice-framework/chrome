const assert = require("node:assert/strict");
const { test } = require("node:test");

const modulePromise = import("../../scripts/validate-release.mjs");

test("accepts intentional release metadata", async () => {
  const { validateRelease } = await modulePromise;
  assert.doesNotThrow(() =>
    validateRelease({
      tag: "v1.2.3",
      manifest: { version: "1.2.3" },
      packageJson: { version: "1.2.3" },
      notes: screenshotNotes("v1.2.3"),
    }),
  );
});

test("rejects mismatched tags and escaped release prose", async () => {
  const { validateRelease } = await modulePromise;
  assert.throws(
    () =>
      validateRelease({
        tag: "v1.2.4",
        manifest: { version: "1.2.3" },
        packageJson: { version: "1.2.3" },
        notes: screenshotNotes("v1.2.4"),
      }),
    /tag does not match/,
  );
  assert.throws(
    () =>
      validateRelease({
        tag: "v1.2.3",
        manifest: { version: "1.2.3" },
        packageJson: { version: "1.2.3" },
        notes: `${screenshotNotes("v1.2.3")}\\nBroken`,
      }),
    /literal \\n/,
  );
});

function screenshotNotes(tag) {
  return `![Dark](https://github.com/spice-framework/chrome/releases/download/${tag}/spice-for-github-settings-dark.png)`;
}
