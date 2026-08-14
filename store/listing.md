# Chrome Web Store submission

## Product details

- **Name:** Spice for GitHub
- **Summary:** Present Spice annotations and conventional View paths on GitHub without changing valid Go source.
- **Category:** Developer Tools
- **Language:** English

### Detailed description

Spice for GitHub makes canonical Spice declarations feel like a native part of GitHub's Go code viewer while preserving every source byte.

Open a Go file, blame view, commit or pull-request diff, or a markdown document with a Go sample on GitHub and the extension recognizes valid Spice declaration comments beginning with `// @`. It visually folds the comment prefix, applies semantic highlighting aligned with GitHub's own Go palette, and places the Spice logo beside GitHub's file actions so you can identify a Spice file at a glance.

Highlights:

- Native GitHub light and dark syntax colors by default.
- Optional GoLand-inspired Spice Vivid and custom semantic palettes.
- File, blame, commit, compare, pull-request diff, review snippet, and markdown fence support, including GitHub client-side navigation.
- Exact source integrity: copying still returns valid Go such as `// @Application`.
- Local-only processing with no analytics, telemetry, remote code, or hidden network requests.
- Conventional Spice View breadcrumbs, source/test/resource/generated labels,
  test-to-source links, and locally collapsible generated diffs.
- Least privilege: the only extension permission is `storage`, used for display settings.

Spice for GitHub changes presentation only. Raw views, copied source, GitHub review data, and repository contents remain unchanged.

## URLs

- **Homepage:** https://github.com/spice-framework/chrome
- **Support:** https://github.com/spice-framework/chrome/issues
- **Privacy policy:** https://github.com/spice-framework/chrome/blob/main/docs/privacy.md

The GitHub organization or repository URL can become the verified official URL after ownership is verified in Google Search Console. Until then, use it as the homepage URL without claiming verified-publisher status.

## Privacy practices

### Single purpose

Improve the local presentation of canonical Spice declaration comments in GitHub file, diff, review, and markdown code views without modifying source content.

### Permission justification: `storage`

Stores and, when Chrome Sync is enabled, synchronizes the user's presentation preferences: whether to visually fold the comment prefix, the selected color theme, and optional custom semantic colors. No repository content or browsing history is stored.

### Site access justification: `https://github.com/*`

The content script must run on GitHub pages to detect canonical Spice declarations in visible file, diff, review, and markdown code views and re-render their presentation locally. It does not transmit, retain, or sell page content, and it does not make network requests.

### Remote code

No. All JavaScript and CSS execute from the submitted Manifest V3 package. The extension does not use remotely hosted code, `eval`, or dynamic code generation.

### Data disclosure

Select the dashboard option indicating that the extension does not collect user data. GitHub page content is inspected ephemerally in the browser solely to provide the visible feature; it is not collected, transmitted, logged, or retained. Settings are stored through Chrome's `storage.sync` API and contain display preferences only.

Certify that the disclosures are accurate and that the extension complies with the Chrome Web Store User Data Policy, including limited-use requirements.

## Distribution

- **Visibility:** Public
- **Regions:** All regions
- **In-app purchases:** No
- **Mature content:** No
- **Deferred publishing:** Enabled for the first submission, so approval can be checked before the listing goes live.

## Reviewer test instructions

No account, paid service, or test credentials are required.

1. Install the submitted extension.
2. Open https://github.com/spice-framework/chrome/blob/main/examples/demo.go.
3. Confirm the canonical declarations are displayed without a visible `// ` prefix and use native GitHub syntax colors.
4. Copy the `@Application` line and confirm the copied text is still `// @Application`.
5. Hover over the Spice logo beside the right-side file controls and confirm its tooltip identifies the file as Spice.
6. Open the extension's Details → Extension options page to verify Native GitHub, Spice Vivid, custom palette, and prefix-folding settings.
7. Open https://github.com/spice-framework/spice/blob/main/docs/getting-started.md and confirm the Go sample's `// @` declarations receive the same presentation.

## Artwork upload order

1. `store/assets/screenshot-settings-dark-1280x800.png`
2. `store/assets/screenshot-github-native-1280x800.png`
3. `extension/assets/logo-128.png`
4. `store/assets/promo-small-440x280.png`
5. `store/assets/promo-marquee-1400x560.png` (optional)
