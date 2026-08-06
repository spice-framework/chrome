# Contributing

Contributions are welcome. Keep changes bounded, preserve the source-integrity and least-privilege invariants in `AGENTS.md`, and add positive, negative, boundary, and stable-order tests for syntax changes.

Before opening a pull request:

```console
npm ci
npx playwright install chromium
npm run verify
```

Run `npm run test:live` when a change touches GitHub selectors or navigation behavior. Do not add broad host permissions, remotely hosted code, analytics, or source-mutating behavior.
