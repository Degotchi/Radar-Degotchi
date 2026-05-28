import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("editorial enrichment falls back to single-item translation when a batch fails", { timeout: 30000 }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "radar-editorial-"));
  process.env.EDITORIAL_CACHE_PATH = join(tempDir, "event-editorial.json");
  process.env.LLM_API_KEY = "test-key";
  process.env.LLM_MODEL = "test-model";
  delete process.env.HTTPS_PROXY;
  delete process.env.https_proxy;
  delete process.env.HTTP_PROXY;
  delete process.env.http_proxy;
  delete process.env.ALL_PROXY;
  delete process.env.all_proxy;

  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const userMessage = body.messages.find((message) => message.role === "user");
    const payload = JSON.parse(userMessage.content);

    if (payload.events.length > 1) {
      response.writeHead(502, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "batch rejected in test" }));
      return;
    }

    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: payload.events.map((event) => ({
                  key: event.key,
                  title_zh: `中文标题 ${event.title}`,
                  title_en: `English title ${event.title}`,
                  summary_zh: `中文摘要说明 ${event.title} 的主要进展。`,
                  summary_en: `English summary for ${event.title} with clear context.`,
                  insight_zh: "这会影响开发者和产品团队的选择。",
                  insight_en: "This matters for developer and product decisions.",
                  detail_zh: `中文详情基于来源信息整理 ${event.title}，不额外编造事实。`,
                  detail_en: `English detail summarizes the source material for ${event.title} without adding new facts.`,
                  bullets_zh: ["中文要点一", "中文要点二"],
                  bullets_en: ["English point one", "English point two"]
                }))
              })
            }
          }
        ]
      })
    );
  });

  await new Promise((resolve) => server.listen(0, resolve));
  process.env.LLM_BASE_URL = `http://127.0.0.1:${server.address().port}`;

  const { applyEditorialEnrichment } = await import("../server/editorialEnrichment.js");
  const snapshot = createSnapshot([
    createEvent("event-1", "OpenAI launches an agent tool"),
    createEvent("event-2", "Anthropic updates Claude Code"),
    createEvent("event-3", "Ollama publishes a local model release")
  ]);

  try {
    const enriched = await applyEditorialEnrichment(snapshot, { allowLlm: true, force: true });

    assert.equal(enriched.diagnostics.editorial.llmGeneratedItems, 3);
    assert.equal(enriched.diagnostics.editorial.translatedItems, 3);
    assert.match(enriched.diagnostics.editorial.llmError, /batch 1-3/);
    assert.ok(enriched.events.every((event) => event.translations.zh.title.includes("中文标题")));
    assert.ok(enriched.events.every((event) => event.translations.en.summary.includes("English summary")));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(tempDir, { recursive: true, force: true });
  }
});

function createSnapshot(events) {
  return {
    events,
    dailyBrief: {
      sections: [{ category: "products", events }],
      risingEvents: events,
      coolingEvents: [],
      watchList: []
    },
    diagnostics: {}
  };
}

function createEvent(id, title) {
  return {
    id,
    title,
    summary: title,
    category: "products",
    status: "rising",
    trend: "rising",
    confidence: 80,
    platformCount: 1,
    sources: [{ name: "Test Source", tier: "T1" }],
    relatedItems: [
      {
        title,
        summary: `${title} is covered by a source item with useful details.`,
        platform: "Test Source",
        originalSource: "Test Source",
        url: `https://example.com/${id}`,
        publishedAt: "2026-05-28T00:00:00.000Z"
      }
    ]
  };
}
