import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  events as mockEvents,
  jobs as mockJobs,
  rawItems as mockRawItems,
  rules as mockRules,
  sources as mockSources
} from "../src/data/mockData.js";
import { getLiveDataset, liveSourceConfigs } from "../src/data/liveSources.js";
import { buildSnapshot } from "../src/lib/scoring.js";
import { ensureDailyBrief, getDailyBriefById, listDailyBriefs, msUntilNextDailyRun } from "./dailyBriefStore.js";
import { applyEditorialEnrichment } from "./editorialEnrichment.js";
import { listFeedback, saveFeedback } from "./feedbackStore.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);
const AUTO_REFRESH_MS = Number(process.env.AUTO_REFRESH_MS || 60 * 60 * 1000);

let snapshotCache = null;
let snapshotRefreshPromise = null;
let snapshotRefreshMeta = null;
let refreshSequence = 0;
const clientDistPath = fileURLToPath(new URL("../dist", import.meta.url));
const clientIndexPath = join(clientDistPath, "index.html");

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  const llmConfig = getLlmConfig();
  res.json({
    ok: true,
    modelConfigured: Boolean(llmConfig.baseUrl && llmConfig.apiKey && llmConfig.model),
    model: llmConfig.model || null,
    liveSources: liveSourceConfigs.length,
    editorialEnrichment: "cached_batch",
    autoRefreshMs: AUTO_REFRESH_MS,
    dailyBriefSchedule: "04:00 Asia/Shanghai"
  });
});

app.get("/api/snapshot", async (_req, res) => {
  try {
    res.json(await getSnapshot());
  } catch (error) {
    res.json(createFallbackSnapshot(error));
  }
});

app.post("/api/jobs/recompute", async (_req, res) => {
  try {
    const snapshot = await refreshSnapshot({ force: true, allowAi: true, reason: "manual" });
    res.json({
      ok: true,
      message: `真实信源抓取完成：${snapshot.diagnostics.successfulSourceCount}/${snapshot.diagnostics.sourceCount} 个信源成功，已刷新卡片摘要缓存。`,
      snapshot
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      message: "真实信源抓取失败，已返回内置兜底数据。",
      snapshot: createFallbackSnapshot(error)
    });
  }
});

app.get("/api/ingest/status", async (_req, res) => {
  try {
    const dataset = await getLiveDataset();
    res.json({ ok: true, ...dataset.diagnostics });
  } catch (error) {
    res.status(502).json({ ok: false, error: error.message, sourceCount: liveSourceConfigs.length });
  }
});

app.get("/api/daily", async (_req, res) => {
  try {
    const snapshot = await getSnapshot();
    const article = await ensureDailyBrief(snapshot);
    res.json({ ok: true, article });
  } catch (error) {
    res.status(502).json({ ok: false, error: error.message });
  }
});

app.get("/api/dailies", async (req, res) => {
  try {
    const snapshot = await getSnapshot();
    await ensureDailyBrief(snapshot);
    const take = Math.min(60, Math.max(1, Number(req.query.take || 30)));
    res.json({ ok: true, articles: await listDailyBriefs({ take }) });
  } catch (error) {
    res.status(502).json({ ok: false, error: error.message, articles: [] });
  }
});

app.get("/api/daily/:id", async (req, res) => {
  const article = await getDailyBriefById(req.params.id);
  if (!article) {
    res.status(404).json({ ok: false, error: "daily_brief_not_found" });
    return;
  }
  res.json({ ok: true, article });
});

app.post("/api/llm/event-summary", async (req, res) => {
  const { eventId } = req.body ?? {};
  let snapshot;
  try {
    snapshot = await getSnapshot();
  } catch (error) {
    snapshot = createFallbackSnapshot(error);
  }
  const event = snapshot.events.find((item) => item.id === eventId) ?? snapshot.events[0];

  if (!event) {
    res.status(404).json({ ok: false, error: "event_not_found" });
    return;
  }

  res.json({
    ok: true,
    eventId: event.id,
    cached: true,
    text: [event.editorSummary, event.editorInsight].filter(Boolean).join("\n")
  });
});

app.post("/api/feedback", async (req, res) => {
  try {
    const feedback = await saveFeedback({
      ...req.body,
      userAgent: req.get("user-agent"),
      referer: req.get("referer")
    });
    res.json({ ok: true, feedback });
  } catch (error) {
    const validationErrors = new Set([
      "feedback_title_required",
      "feedback_content_required",
      "feedback_title_too_long",
      "feedback_content_too_long",
      "feedback_email_too_long"
    ]);
    res.status(validationErrors.has(error.message) ? 400 : 500).json({ ok: false, error: error.message });
  }
});

app.get("/api/admin/feedback", async (req, res) => {
  try {
    const take = Math.min(300, Math.max(1, Number(req.query.take || 100)));
    res.json({ ok: true, feedback: await listFeedback({ take }) });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message, feedback: [] });
  }
});

if (existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath, { index: false }));
  app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(clientIndexPath);
  });
}

async function getSnapshot() {
  if (snapshotCache) return snapshotCache;
  return refreshSnapshot({ allowAi: true, reason: "request" });
}

async function refreshSnapshot({ force = false, allowAi = false, reason = "auto" } = {}) {
  const needsAi = Boolean(allowAi);
  if (snapshotRefreshPromise && (!needsAi || snapshotRefreshMeta?.allowAi)) return snapshotRefreshPromise;

  const sequence = (refreshSequence += 1);
  snapshotRefreshMeta = { allowAi: needsAi, reason };
  snapshotRefreshPromise = createSnapshot({ force, allowAi })
    .then(async (snapshot) => {
      const nextSnapshot = withRefreshPolicy(snapshot, reason);
      if (sequence === refreshSequence) {
        snapshotCache = nextSnapshot;
        await ensureDailyBrief(snapshotCache);
      }
      return nextSnapshot;
    })
    .finally(() => {
      if (sequence === refreshSequence) {
        snapshotRefreshPromise = null;
        snapshotRefreshMeta = null;
      }
    });

  return snapshotRefreshPromise;
}

async function createSnapshot({ force = false, allowAi = false } = {}) {
  const dataset = await getLiveDataset({ force });
  const snapshot = {
    ...buildSnapshot(dataset),
    dataMode: "live",
    diagnostics: dataset.diagnostics
  };
  const configuredLimit = process.env.AI_ENRICHMENT_LIMIT ? Number(process.env.AI_ENRICHMENT_LIMIT) : snapshot.events.length;
  return applyEditorialEnrichment(snapshot, {
    allowLlm: allowAi,
    limit: Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : snapshot.events.length
  });
}

function withRefreshPolicy(snapshot, reason) {
  return {
    ...snapshot,
    refreshPolicy: {
      intervalMs: AUTO_REFRESH_MS,
      intervalLabel: "每 1 小时自动刷新",
      lastRefreshAt: snapshot.generatedAt,
      lastRefreshReason: reason,
      nextRefreshAt: new Date(Date.now() + AUTO_REFRESH_MS).toISOString(),
      dailyBriefSchedule: "每日 04:00 汇总过去 24 小时"
    }
  };
}

function createFallbackSnapshot(error) {
  return {
    ...buildSnapshot({
      events: mockEvents,
      sources: mockSources,
      rawItems: mockRawItems,
      rules: mockRules,
      jobs: mockJobs
    }),
    dataMode: "mock-fallback",
    diagnostics: {
      generatedAt: new Date().toISOString(),
      sourceCount: liveSourceConfigs.length,
      successfulSourceCount: 0,
      failedSourceCount: liveSourceConfigs.length,
      error: error?.message || "live_ingest_failed"
    }
  };
}

function getLlmConfig() {
  return {
    baseUrl: process.env.LLM_BASE_URL || process.env.SF_BASE_URL || "",
    apiKey: process.env.LLM_API_KEY || process.env.SF_API_KEY || "",
    model: process.env.LLM_MODEL || process.env.SF_MODEL || "deepseek-chat"
  };
}

app.listen(port, () => {
  console.log(`AI Signal Cockpit API listening on http://localhost:${port}`);
  startAutoRefresh();
  refreshSnapshot({ force: true, allowAi: true, reason: "startup" }).catch((error) => {
    console.error("Initial refresh failed:", error.message);
  });
});

function startAutoRefresh() {
  const hourly = setInterval(() => {
    refreshSnapshot({ force: true, allowAi: true, reason: "auto-hourly" }).catch((error) => {
      console.error("Hourly refresh failed:", error.message);
    });
  }, AUTO_REFRESH_MS);
  hourly.unref?.();
  scheduleDailyBriefRun();
}

function scheduleDailyBriefRun() {
  const timer = setTimeout(() => {
    refreshSnapshot({ force: true, allowAi: true, reason: "daily-04:00" })
      .then((snapshot) => ensureDailyBrief(snapshot, { force: true }))
      .catch((error) => {
        console.error("Daily brief generation failed:", error.message);
      })
      .finally(scheduleDailyBriefRun);
  }, msUntilNextDailyRun());
  timer.unref?.();
}
