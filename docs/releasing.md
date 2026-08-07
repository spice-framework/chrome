# Releasing

Spice for GitHub uses a keyless GitHub Actions release pipeline. A version tag is the only release trigger. The workflow verifies the exact tagged tree, creates the deterministic extension ZIP, exchanges GitHub's short-lived OIDC identity for a five-minute Google access token, uploads and submits the package through Chrome Web Store API v2, and creates the matching GitHub Release with its checksum and dark product screenshot.

No Google service-account key, OAuth client secret, or refresh token is stored in GitHub.

## One-time Chrome Web Store bootstrap

Chrome Web Store API v2 cannot create the first Store item or edit listing metadata. Complete these steps once in the Developer Dashboard:

1. Under **Account**, add `chrome-web-store-publisher@spice-framework-cws.iam.gserviceaccount.com` as the publisher service account.
2. Choose **Add new item** and upload `build/spice-for-github-v0.1.1.zip`.
3. Complete the Store listing, privacy, distribution, and reviewer fields using [`store/listing.md`](../store/listing.md) and its artwork.
4. Set visibility to **Public** and submit the first version manually. Google requires the first publication after a visibility change to be manual.
5. Record the Publisher ID from **Account** and the extension Item ID from the new item's dashboard URL.

The one-time manual publication establishes the item and its visibility. Every higher version can then be shipped from GitHub.

## GitHub environment

The `chrome-web-store` GitHub environment provides four non-secret variables:

- `CWS_EXTENSION_ID`
- `CWS_PUBLISHER_ID`
- `GCP_SERVICE_ACCOUNT`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`

Google Workload Identity Federation admits only `spice-framework/chrome` workflows running from `main` or a `v*` tag, and only that identity may impersonate the Store publisher service account.

## Cut a release

1. Increase `version` in `package.json`, `package-lock.json`, and `extension/manifest.json`.
2. Add `docs/releases/vX.Y.Z.md` with real Markdown and the dark screenshot URL for that tag.
3. Run `npm run verify` and `npm run test:live` using Node.js 24.
4. Commit and push the green tree to `main` after fetching and confirming that `origin/main` has not moved.
5. Create and push the signed release tag `vX.Y.Z`.

The `Release` workflow refuses mismatched versions, missing notes, escaped newline prose, verification failures, active review conflicts, Store warnings, or failed uploads. Rerunning a tag whose version is already submitted or published is safe.

The same workflow has manual `status` and `publish-existing-draft` operations for Store bootstrap and diagnosis. Normal releases use the tag path only.
