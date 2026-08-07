import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";
import {
  concealmentRange,
  highlightTokens,
  parseAnnotation,
  parseImportDirective,
} from "../packages/spice-syntax/index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cases = [
  [
    "named-import",
    '// @import { Application, Service } from "github.com/spice-framework/spice/annotation/core"',
  ],
  [
    "alias-import",
    '// @import { Controller as WebController } from "github.com/spice-framework/spice/annotation/web"',
  ],
  [
    "namespace-import",
    '// @import * as web from "github.com/spice-framework/spice/annotation/web"',
  ],
  [
    "qualified-values",
    '// @management.Enable(expose=["health"], access="loopback", retries=-1, enabled=true, check=health.Checker, empty=nil)',
  ],
  ["canonical-spacing", "// @Application"],
  ["noncanonical-spacing", "//  @Application"],
  ["malformed-string", '// @Application(name="unterminated)'],
  ["ordinary-comment", "// ordinary @Application text"],
  ["compact-prefix", "//@Application"],
  ["malformed-suffix", "// @Application trailing"],
];

const corpus = {
  schema: 1,
  cases: cases.map(([id, source]) => {
    const annotation = parseAnnotation(source);
    const imported = parseImportDirective(source);
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
      tokens: highlightTokens(source).map((token) => ({
        ...token,
        text: source.slice(token.start, token.end),
      })),
      concealment: concealmentRange(source),
    };
  }),
};

const output = path.join(
  root,
  "packages",
  "spice-syntax",
  "fixtures",
  "syntax-corpus.json",
);
await mkdir(path.dirname(output), { recursive: true });
const content = await format(JSON.stringify(corpus), { parser: "json" });
await writeFile(output, content, "utf8");
console.log(`Generated ${corpus.cases.length} syntax fixtures at ${output}`);
