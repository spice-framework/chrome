"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PREFIX,
  TokenKind,
  parseAnnotation,
  parseImportDirective,
  highlightTokens,
  concealmentRange,
} = require("../../packages/spice-syntax/src/index.cjs");

test("recognizes only the exact canonical declaration prefix", () => {
  assert.equal(PREFIX, "// @");
  assert.equal(parseAnnotation("// @Application").name, "Application");
  assert.equal(parseAnnotation("// @web.Controller").name, "web.Controller");
  for (const invalid of [
    "//@Application",
    "//  @Application",
    "// ordinary @Application text",
    "// @9Invalid",
    "// @broken.",
    "// @Application trailing",
  ]) {
    assert.equal(parseAnnotation(invalid), null, invalid);
    assert.deepEqual(highlightTokens(invalid), [], invalid);
    assert.equal(concealmentRange(invalid), null, invalid);
  }
});

test("highlights a qualified annotation with GoLand semantic categories", () => {
  const source =
    '// @management.Enable(expose=["health"], access="loopback", retries=-1, enabled=true)';
  const tokens = highlightTokens(source);
  assert.deepEqual(
    tokens.map(({ kind, start, end }) => [kind, source.slice(start, end)]),
    [
      [TokenKind.PREFIX, "// "],
      [TokenKind.SIGIL, "@"],
      [TokenKind.NAMESPACE, "management"],
      [TokenKind.OPERATOR, "."],
      [TokenKind.ANNOTATION, "Enable"],
      [TokenKind.OPERATOR, "("],
      [TokenKind.PARAMETER, "expose"],
      [TokenKind.OPERATOR, "="],
      [TokenKind.OPERATOR, "["],
      [TokenKind.STRING, '"health"'],
      [TokenKind.OPERATOR, "]"],
      [TokenKind.OPERATOR, ","],
      [TokenKind.PARAMETER, "access"],
      [TokenKind.OPERATOR, "="],
      [TokenKind.STRING, '"loopback"'],
      [TokenKind.OPERATOR, ","],
      [TokenKind.PARAMETER, "retries"],
      [TokenKind.OPERATOR, "="],
      [TokenKind.NUMBER, "-1"],
      [TokenKind.OPERATOR, ","],
      [TokenKind.PARAMETER, "enabled"],
      [TokenKind.OPERATOR, "="],
      [TokenKind.BOOLEAN, "true"],
      [TokenKind.OPERATOR, ")"],
    ],
  );
  assert.deepEqual(concealmentRange(source), [0, 3]);
});

test("classifies qualified and unqualified type references", () => {
  const source =
    "// @Implements(payments.Processor, health.Checker, LocalType, nil)";
  const semantic = highlightTokens(source).map(({ kind, start, end }) => [
    kind,
    source.slice(start, end),
  ]);
  assert(
    semantic.some(
      ([kind, text]) => kind === TokenKind.NAMESPACE && text === "payments",
    ),
  );
  assert(
    semantic.some(
      ([kind, text]) =>
        kind === TokenKind.TYPE_REFERENCE && text === "Processor",
    ),
  );
  assert(
    semantic.some(
      ([kind, text]) =>
        kind === TokenKind.TYPE_REFERENCE && text === "LocalType",
    ),
  );
  assert(
    semantic.some(
      ([kind, text]) => kind === TokenKind.BOOLEAN && text === "nil",
    ),
  );
});

test("parses and highlights named imports, including an import-named symbol", () => {
  const source =
    '// @import { Application, Controller as WebController, import as localImport } from "github.com/spice-framework/spice"';
  const parsed = parseImportDirective(source);
  assert.equal(parsed.packagePath, "github.com/spice-framework/spice");
  assert.deepEqual(
    parsed.bindings.map(({ importedName, localName }) => [
      importedName,
      localName,
    ]),
    [
      ["Application", "Application"],
      ["Controller", "WebController"],
      ["import", "localImport"],
    ],
  );
  for (const binding of parsed.bindings) {
    assert.equal(
      source.slice(...binding.importedRange),
      binding.importedName,
      binding.importedName,
    );
    assert.equal(
      source.slice(...binding.localRange),
      binding.localName,
      binding.localName,
    );
  }
  const tokens = highlightTokens(source);
  assert(tokens.some(({ kind }) => kind === TokenKind.IMPORT_ALIAS));
  assert(tokens.some(({ kind }) => kind === TokenKind.STRING));
  assert(
    tokens.some(
      ({ kind, start, end }) =>
        kind === TokenKind.IMPORT_SYMBOL &&
        source.slice(start, end) === "import",
    ),
  );
  assert.deepEqual(concealmentRange(source), [0, 3]);
});

test("parses namespace imports without confusing an import-named alias", () => {
  const source = '// @import * as import from "github.com/acme/web"';
  const parsed = parseImportDirective(source);
  assert.equal(parsed.bindings[0].namespace, true);
  assert.equal(parsed.bindings[0].localName, "import");
  assert.equal(source.slice(...parsed.bindings[0].localRange), "import");
  assert(
    highlightTokens(source).some(
      ({ kind, start, end }) =>
        kind === TokenKind.NAMESPACE && source.slice(start, end) === "import",
    ),
  );
});

test("rejects malformed and retired import spellings", () => {
  for (const source of [
    '// @import Application from "example.com/app"',
    '// @import { Application, } from "example.com/app"',
    '// @import * web from "example.com/web"',
    '// @import { 9Invalid } from "example.com/app"',
    '// @imports { Application } from "example.com/app"',
  ]) {
    assert.equal(parseImportDirective(source), null, source);
    assert.deepEqual(highlightTokens(source), [], source);
  }
});

test("token order is stable and non-overlapping", () => {
  const source = '// @Application(name="petclinic", count=2, ready=false)';
  const first = highlightTokens(source);
  const second = highlightTokens(source);
  assert.deepEqual(first, second);
  for (let index = 1; index < first.length; index += 1) {
    assert(first[index - 1].end <= first[index].start);
  }
});
