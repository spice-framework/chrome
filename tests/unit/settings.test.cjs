"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  COLOR_DEFINITIONS,
  DEFAULT_SETTINGS,
  NATIVE_PREVIEW_COLORS,
  VIVID_COLORS,
  normalizeSettings,
  isColor,
} = require("../../packages/spice-syntax/src/palette.cjs");

test("defaults cover every GoLand semantic token category", () => {
  assert.deepEqual(
    COLOR_DEFINITIONS.map(({ key }) => key),
    [
      "prefix",
      "sigil",
      "namespace",
      "annotation",
      "parameter",
      "importSymbol",
      "importAlias",
      "typeReference",
      "string",
      "number",
      "boolean",
      "identifier",
      "keyword",
      "operator",
    ],
  );
  assert.equal(DEFAULT_SETTINGS.theme, "native");
  assert.equal(DEFAULT_SETTINGS.concealPrefix, true);
  assert.equal(NATIVE_PREVIEW_COLORS.namespace, "#c9d1d9");
  assert.equal(NATIVE_PREVIEW_COLORS.annotation, "#d2a8ff");
  assert.equal(VIVID_COLORS.namespace, "#d2a8ff");
  assert.equal(VIVID_COLORS.annotation, "#ff7b72");
});

test("normalization migrates the retired GitHub theme and preserves vivid", () => {
  assert.equal(normalizeSettings({ theme: "github" }).theme, "native");
  assert.equal(normalizeSettings({ theme: "native" }).theme, "native");
  assert.equal(normalizeSettings({ theme: "vivid" }).theme, "vivid");
});

test("normalization accepts valid settings and repairs invalid fields", () => {
  const normalized = normalizeSettings({
    theme: "custom",
    concealPrefix: false,
    colors: { annotation: "#ABCDEF", string: "red" },
  });
  assert.equal(normalized.theme, "custom");
  assert.equal(normalized.concealPrefix, false);
  assert.equal(normalized.colors.annotation, "#abcdef");
  assert.equal(normalized.colors.string, DEFAULT_SETTINGS.colors.string);
  assert(Object.isFrozen(normalized));
  assert(Object.isFrozen(normalized.colors));
});

test("color validation is deliberately strict", () => {
  assert.equal(isColor("#012aEF"), true);
  for (const invalid of ["fff", "#fff", "#gggggg", "rgb(1,2,3)", null]) {
    assert.equal(isColor(invalid), false);
  }
});
