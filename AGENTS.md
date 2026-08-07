# Spice for GitHub implementation contract

## Mission

Deliver a privacy-preserving Chrome extension that presents canonical Spice
declaration comments as native annotations on GitHub while leaving valid Go
source, copy behavior, raw views, reviews, and Git content unchanged.

## Public invariants

- Only canonical `// @...` Spice syntax in `.go` blob and diff views is
  presented as Spice code. Ordinary and malformed comments remain untouched.
- Prefix concealment and semantic coloring are presentation only. The visible
  code line's `textContent`, GitHub's read-only source buffer, copied text, raw
  source, and repository bytes must retain the physical `// ` prefix.
- Semantic token categories track the Spice GoLand plugin: prefix, sigil,
  namespace, annotation, argument, imported symbol, import alias, type
  reference, string, number, Boolean, identifier, keyword, and punctuation.
- An icon-only Spice indicator appears beside GitHub's right-side file actions
  only when at least one canonical Spice line is detected in the current Go
  file or diff. Its label is exposed through accessible and hover text, and its
  explicit link opens the canonical Spice repository.
- GitHub SPA navigation and incrementally rendered diff lines must be handled
  idempotently without modifying ordinary Go syntax spans.
- The extension requests only GitHub content-script access and synchronized
  settings storage. It has no telemetry, remote code, hidden network calls,
  tabs permission, browsing-history access, or source mutation capability.

## Delivery

- Work directly on local `main` in bounded, reviewable commits.
- Use Node.js 22.13 or newer on an even-numbered LTS release.
- Run `npm run verify` on the exact tree before every commit.
- Run `npm run test:live` before release or after GitHub changes its file-view
  DOM.
- Fetch immediately before pushing and stop if `origin/main` moved
  unexpectedly.
- Commit source, tests, documentation, and deterministic package metadata.
  Do not commit `node_modules`, build output, browser profiles, or transient
  verification artifacts.
