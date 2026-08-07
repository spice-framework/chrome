"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const corpus = require("../../packages/spice-syntax/fixtures/syntax-corpus.json");
const syntax = require("../../packages/spice-syntax/src/index.cjs");
const palette = require("../../packages/spice-syntax/src/palette.cjs");

test("shared language-neutral corpus preserves the pre-extraction behavior", () => {
  assert.equal(corpus.schema, 1);
  assert.equal(corpus.cases.length, 10);
  for (const fixture of corpus.cases) {
    assert.deepEqual(
      renderFixture(syntax, fixture.id, fixture.source),
      fixture,
    );
  }
});

test("ESM build entry exposes the exact extension tokenizer", async () => {
  const esm = await import("../../packages/spice-syntax/index.mjs");
  for (const fixture of corpus.cases) {
    assert.deepEqual(
      renderFixture(esm, fixture.id, fixture.source),
      fixture,
      fixture.id,
    );
  }
  assert.equal(esm.default.PREFIX, syntax.PREFIX);
});

test("ESM palette entry exposes the exact extension palettes", async () => {
  const esm = await import("../../packages/spice-syntax/palette.mjs");
  assert.deepEqual(esm.COLOR_DEFINITIONS, palette.COLOR_DEFINITIONS);
  assert.deepEqual(esm.NATIVE_PREVIEW_COLORS, palette.NATIVE_PREVIEW_COLORS);
  assert.deepEqual(esm.VIVID_COLORS, palette.VIVID_COLORS);
  assert.deepEqual(esm.DEFAULT_SETTINGS, palette.DEFAULT_SETTINGS);
});

function renderFixture(api, id, source) {
  const annotation = api.parseAnnotation(source);
  const imported = api.parseImportDirective(source);
  return {
    id,
    source,
    annotation: annotation
      ? {
          name: annotation.name,
          prefixRange: annotation.prefixRange,
          referenceRange: annotation.referenceRange,
        }
      : null,
    import: imported
      ? {
          packagePath: imported.packagePath,
          packageRange: imported.packageRange,
          bindings: imported.bindings,
        }
      : null,
    tokens: api.highlightTokens(source).map((token) => ({
      ...token,
      text: source.slice(token.start, token.end),
    })),
    concealment: api.concealmentRange(source),
  };
}
