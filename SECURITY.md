# Security policy

## Supported versions

Security fixes are applied to the latest release on `main`.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository. Do not open a public issue for an undisclosed vulnerability. Include the affected version, reproduction steps, impact, and any suggested mitigation.

The extension intentionally has a narrow security surface: Manifest V3, an isolated content-script world limited to `https://github.com/*`, the `storage` permission only, no remote code, no telemetry, and no external network requests.
