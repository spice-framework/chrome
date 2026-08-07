# Spice syntax package

This private package is the browser-neutral source of truth for canonical
Spice declaration tokenization and Native/Spice Vivid semantic palettes. The
Chrome extension packages the CommonJS-compatible classic-script sources, and
static documentation tooling imports the ESM entries at build time.

The package does not rewrite source. It recognizes only canonical physical
`// @` declaration comments, returns stable source ranges, and leaves malformed
or ordinary comments unclassified. Consumers may visually conceal the prefix,
but copied text and repository bytes must remain valid Go.

`fixtures/syntax-corpus.json` is a language-neutral parity oracle covering
named, alias, and namespace imports; qualified annotations and every supported
value kind; malformed/noncanonical input; and ordinary comments. Regenerate it
only after an intentional reviewed language-contract change:

```text
npm run syntax:fixtures
```
