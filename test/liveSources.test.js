import assert from "node:assert/strict";
import test from "node:test";
import { fetchLiveData, liveSourceConfigs } from "../src/data/liveSources.js";

test("live AI source ingestion fetches at least 20 working sources", { timeout: 120000 }, async () => {
  const dataset = await fetchLiveData({ force: true });
  const failedSources = dataset.diagnostics.sourceResults.filter((source) => !source.ok || source.itemCount === 0);

  assert.ok(liveSourceConfigs.length >= 20, `expected at least 20 source configs, got ${liveSourceConfigs.length}`);
  assert.ok(
    dataset.diagnostics.successfulSourceCount >= 20,
    `expected at least 20 successful sources, got ${dataset.diagnostics.successfulSourceCount}; failed: ${failedSources
      .map((source) => `${source.id}:${source.status}:${source.itemCount}:${source.error}`)
      .join(", ")}`
  );
  assert.equal(
    failedSources.length,
    0,
    `expected every configured source to return items; failed: ${failedSources
      .map((source) => `${source.id}:${source.status}:${source.itemCount}:${source.error}`)
      .join(", ")}`
  );
  assert.ok(dataset.rawItems.length >= 40, `expected at least 40 raw items, got ${dataset.rawItems.length}`);
  assert.ok(dataset.events.length >= 20, `expected at least 20 events, got ${dataset.events.length}`);
  assert.ok(dataset.rawItems.every((item) => item.id.startsWith("raw-live-")), "expected live raw item ids");
});
