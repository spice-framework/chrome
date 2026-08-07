import assert from "node:assert/strict";
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const apiOrigin = "https://chromewebstore.googleapis.com";
const acceptedPublishStates = new Set([
  "PENDING_REVIEW",
  "STAGED",
  "PUBLISHED",
  "PUBLISHED_TO_TESTERS",
]);

export async function deployChromeWebStore(options) {
  const config = normalizeConfig(options);
  const initialStatus = await fetchStoreStatus(config);
  const publishedVersion = revisionVersion(
    initialStatus.publishedItemRevisionStatus,
  );
  if (publishedVersion === config.expectedVersion) {
    return {
      disposition: "already-published",
      version: config.expectedVersion,
      status: initialStatus,
    };
  }

  const submittedVersion = revisionVersion(
    initialStatus.submittedItemRevisionStatus,
  );
  if (submittedVersion === config.expectedVersion) {
    return {
      disposition: "already-submitted",
      version: config.expectedVersion,
      status: initialStatus,
    };
  }
  if (
    submittedVersion &&
    initialStatus.submittedItemRevisionStatus?.state === "PENDING_REVIEW"
  ) {
    throw new Error(
      `Chrome Web Store version ${submittedVersion} is already pending review`,
    );
  }

  const packageBuffer =
    config.packageBuffer ?? (await readFile(config.packagePath));
  let upload = await requestJson(config, uploadUrl(config), {
    method: "POST",
    headers: { "Content-Type": "application/zip" },
    body: packageBuffer,
  });

  if (upload.uploadState === "IN_PROGRESS") {
    upload = await pollUpload(config);
  }
  assert.equal(
    upload.uploadState ?? upload.lastAsyncUploadState,
    "SUCCEEDED",
    `Chrome Web Store upload failed: ${JSON.stringify(upload)}`,
  );
  if (upload.crxVersion) {
    assert.equal(
      upload.crxVersion,
      config.expectedVersion,
      "Chrome Web Store processed the wrong package version",
    );
  }

  const submission = await publishExistingDraft(config);
  return {
    disposition: "submitted",
    version: config.expectedVersion,
    upload,
    submission,
  };
}

export async function publishExistingDraft(options) {
  const config = normalizeConfig(options, { packageRequired: false });
  const submission = await requestJson(config, publishUrl(config), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publishType: "DEFAULT_PUBLISH",
      blockOnWarnings: true,
    }),
  });
  assert(
    acceptedPublishStates.has(submission.state),
    `unexpected Chrome Web Store publish state: ${JSON.stringify(submission)}`,
  );
  return submission;
}

export async function fetchStoreStatus(options) {
  const config = normalizeConfig(options, { packageRequired: false });
  return requestJson(config, `${itemUrl(config)}:fetchStatus`, {
    method: "GET",
  });
}

async function pollUpload(config) {
  for (let attempt = 1; attempt <= config.maxPolls; attempt += 1) {
    await config.wait(config.pollIntervalMs);
    const status = await fetchStoreStatus(config);
    if (status.lastAsyncUploadState === "SUCCEEDED") {
      return status;
    }
    if (
      status.lastAsyncUploadState === "FAILED" ||
      status.lastAsyncUploadState === "NOT_FOUND"
    ) {
      throw new Error(
        `Chrome Web Store upload failed: ${JSON.stringify(status)}`,
      );
    }
  }
  throw new Error(
    `Chrome Web Store upload did not finish after ${config.maxPolls} polls`,
  );
}

async function requestJson(config, url, init) {
  const response = await config.fetchImpl(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await response.text();
  let parsed;
  try {
    parsed = body ? JSON.parse(body) : {};
  } catch {
    parsed = { raw: body.slice(0, 1000) };
  }
  if (!response.ok) {
    throw new Error(
      `Chrome Web Store API ${response.status} ${response.statusText}: ${JSON.stringify(parsed)}`,
    );
  }
  return parsed;
}

function normalizeConfig(options, { packageRequired = true } = {}) {
  const config = {
    fetchImpl: options.fetchImpl ?? fetch,
    wait:
      options.wait ??
      ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds))),
    pollIntervalMs: options.pollIntervalMs ?? 2000,
    maxPolls: options.maxPolls ?? 60,
    accessToken: required(options.accessToken, "access token"),
    publisherId: required(options.publisherId, "publisher ID"),
    extensionId: required(options.extensionId, "extension ID"),
    expectedVersion: options.expectedVersion,
    packagePath: options.packagePath,
    packageBuffer: options.packageBuffer,
  };
  if (packageRequired) {
    required(config.expectedVersion, "expected version");
    if (!config.packagePath && !config.packageBuffer) {
      throw new Error("Chrome Web Store package path or buffer is required");
    }
  }
  return config;
}

function required(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Chrome Web Store ${label} is required`);
  }
  return value;
}

function itemUrl(config) {
  return `${apiOrigin}/v2/publishers/${encodeURIComponent(config.publisherId)}/items/${encodeURIComponent(config.extensionId)}`;
}

function uploadUrl(config) {
  return `${apiOrigin}/upload/v2/publishers/${encodeURIComponent(config.publisherId)}/items/${encodeURIComponent(config.extensionId)}:upload`;
}

function publishUrl(config) {
  return `${itemUrl(config)}:publish`;
}

function revisionVersion(revision) {
  return revision?.distributionChannels?.find((channel) => channel.crxVersion)
    ?.crxVersion;
}

async function runCli() {
  const command = process.argv[2] ?? "deploy";
  const config = {
    accessToken: process.env.CWS_ACCESS_TOKEN,
    publisherId: process.env.CWS_PUBLISHER_ID,
    extensionId: process.env.CWS_EXTENSION_ID,
    expectedVersion: process.env.CWS_VERSION,
    packagePath: process.env.CWS_PACKAGE,
  };
  let result;
  if (command === "deploy") {
    result = await deployChromeWebStore(config);
  } else if (command === "publish-existing-draft") {
    result = await publishExistingDraft(config);
  } else if (command === "status") {
    result = await fetchStoreStatus(config);
  } else {
    throw new Error(`unknown Chrome Web Store command: ${command}`);
  }
  const output = JSON.stringify(result, null, 2);
  console.log(output);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## Chrome Web Store ${command}\n\n\`\`\`json\n${output}\n\`\`\`\n`,
    );
  }
}

const invokedAsScript =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedAsScript) {
  await runCli();
}
