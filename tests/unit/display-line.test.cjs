"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  TokenKind,
  highlightTokens,
  highlightDisplayLine,
  concealmentRange,
  concealmentRangeForDisplayLine,
} = require("../../packages/spice-syntax/src/index.cjs");

function tokenSlices(source, tokens) {
  return tokens.map(({ kind, start, end }) => [kind, source.slice(start, end)]);
}

function reconstruct(source, tokens) {
  if (tokens.length === 0) {
    return source;
  }
  let reconstructed = source.slice(0, tokens[0].start);
  for (const token of tokens) {
    reconstructed += source.slice(token.start, token.end);
  }
  return reconstructed + source.slice(tokens.at(-1).end);
}

test("highlightDisplayLine matches highlightTokens for a physical declaration", () => {
  const source = "// @Application";
  assert.deepEqual(highlightDisplayLine(source), highlightTokens(source));
  assert.deepEqual(
    concealmentRangeForDisplayLine(source),
    concealmentRange(source),
  );
});

test("highlightDisplayLine shifts tokens after leading indent", () => {
  const source = "    // @Application";
  const tokens = highlightDisplayLine(source);
  assert.deepEqual(tokenSlices(source, tokens), [
    [TokenKind.PREFIX, "// "],
    [TokenKind.SIGIL, "@"],
    [TokenKind.ANNOTATION, "Application"],
  ]);
  assert.equal(tokens[0].start, 4);
  assert.equal(reconstruct(source, tokens), source);
  assert.deepEqual(concealmentRangeForDisplayLine(source), [4, 7]);
});

test("highlightDisplayLine accepts unified-diff added, context, and removed markers", () => {
  for (const source of [
    "+// @Application",
    " // @Application",
    "-// @Application",
  ]) {
    const tokens = highlightDisplayLine(source);
    assert.deepEqual(tokenSlices(source, tokens), [
      [TokenKind.PREFIX, "// "],
      [TokenKind.SIGIL, "@"],
      [TokenKind.ANNOTATION, "Application"],
    ]);
    assert.equal(tokens[0].start, 1);
    assert.equal(reconstruct(source, tokens), source);
    assert.deepEqual(concealmentRangeForDisplayLine(source), [1, 4], source);
  }
});

test("highlightDisplayLine accepts a diff marker followed by indent", () => {
  const source = "+    // @Application";
  const tokens = highlightDisplayLine(source);
  assert.deepEqual(tokenSlices(source, tokens), [
    [TokenKind.PREFIX, "// "],
    [TokenKind.SIGIL, "@"],
    [TokenKind.ANNOTATION, "Application"],
  ]);
  assert.equal(tokens[0].start, 5);
  assert.equal(reconstruct(source, tokens), source);
  assert.deepEqual(concealmentRangeForDisplayLine(source), [5, 8]);
});

test("highlightDisplayLine ignores ordinary comments and non-Spice lines", () => {
  for (const source of [
    "// ordinary @Application text",
    "func main() {}",
    "+func main() {}",
  ]) {
    assert.deepEqual(highlightDisplayLine(source), [], source);
    assert.equal(concealmentRangeForDisplayLine(source), null, source);
  }
});
