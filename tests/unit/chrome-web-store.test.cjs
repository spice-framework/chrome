const assert = require("node:assert/strict");
const { test } = require("node:test");

const modulePromise = import("../../scripts/chrome-web-store.mjs");

test("uploads and submits a new version", async () => {
  const { deployChromeWebStore } = await modulePromise;
  const requests = [];
  const responses = [
    json({
      publishedItemRevisionStatus: {
        state: "PUBLISHED",
        distributionChannels: [{ crxVersion: "0.1.1" }],
      },
    }),
    json({ uploadState: "SUCCEEDED", crxVersion: "0.1.2" }),
    json({ itemId: "extension-id", state: "PENDING_REVIEW" }),
  ];
  const result = await deployChromeWebStore({
    ...config(),
    packageBuffer: Buffer.from("zip"),
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return responses.shift();
    },
  });

  assert.equal(result.disposition, "submitted");
  assert.equal(requests.length, 3);
  assert.match(requests[1].url, /\/upload\/v2\/publishers\/publisher-id/);
  assert.equal(requests[1].init.headers.Authorization, "Bearer token");
  assert.deepEqual(JSON.parse(requests[2].init.body), {
    publishType: "DEFAULT_PUBLISH",
    blockOnWarnings: true,
  });
});

test("is idempotent when the version is already submitted", async () => {
  const { deployChromeWebStore } = await modulePromise;
  let requests = 0;
  const result = await deployChromeWebStore({
    ...config(),
    packageBuffer: Buffer.from("zip"),
    fetchImpl: async () => {
      requests += 1;
      return json({
        submittedItemRevisionStatus: {
          state: "PENDING_REVIEW",
          distributionChannels: [{ crxVersion: "0.1.2" }],
        },
      });
    },
  });

  assert.equal(result.disposition, "already-submitted");
  assert.equal(requests, 1);
});

test("polls an asynchronous upload before publishing", async () => {
  const { deployChromeWebStore } = await modulePromise;
  const responses = [
    json({}),
    json({ uploadState: "IN_PROGRESS" }),
    json({ lastAsyncUploadState: "IN_PROGRESS" }),
    json({ lastAsyncUploadState: "SUCCEEDED" }),
    json({ itemId: "extension-id", state: "PENDING_REVIEW" }),
  ];
  let waits = 0;
  const result = await deployChromeWebStore({
    ...config(),
    packageBuffer: Buffer.from("zip"),
    fetchImpl: async () => responses.shift(),
    wait: async () => {
      waits += 1;
    },
  });

  assert.equal(result.disposition, "submitted");
  assert.equal(waits, 2);
});

test("stops when another version is pending review", async () => {
  const { deployChromeWebStore } = await modulePromise;
  await assert.rejects(
    deployChromeWebStore({
      ...config(),
      packageBuffer: Buffer.from("zip"),
      fetchImpl: async () =>
        json({
          submittedItemRevisionStatus: {
            state: "PENDING_REVIEW",
            distributionChannels: [{ crxVersion: "0.1.9" }],
          },
        }),
    }),
    /0\.1\.9 is already pending review/,
  );
});

test("fails after a bounded asynchronous upload timeout", async () => {
  const { deployChromeWebStore } = await modulePromise;
  const responses = [
    json({}),
    json({ uploadState: "IN_PROGRESS" }),
    json({ lastAsyncUploadState: "IN_PROGRESS" }),
    json({ lastAsyncUploadState: "IN_PROGRESS" }),
  ];
  await assert.rejects(
    deployChromeWebStore({
      ...config(),
      packageBuffer: Buffer.from("zip"),
      fetchImpl: async () => responses.shift(),
      wait: async () => {},
      maxPolls: 2,
    }),
    /did not finish after 2 polls/,
  );
});

test("reports API failures without exposing the access token", async () => {
  const { fetchStoreStatus } = await modulePromise;
  await assert.rejects(
    fetchStoreStatus({
      ...config(),
      fetchImpl: async () => json({ error: "denied" }, 403),
    }),
    (error) => {
      assert.match(error.message, /403/);
      assert.doesNotMatch(error.message, /Bearer token/);
      return true;
    },
  );
});

function config() {
  return {
    accessToken: "token",
    publisherId: "publisher-id",
    extensionId: "extension-id",
    expectedVersion: "0.1.2",
  };
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
