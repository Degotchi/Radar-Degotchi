import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const STORE_PATH = fileURLToPath(new URL("../.cache/daily-briefs.json", import.meta.url));
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const CST_OFFSET_MS = 8 * HOUR_MS;

export async function listDailyBriefs({ take = 30 } = {}) {
  const store = await loadStore();
  return store.entries.slice(0, take);
}

export async function getDailyBriefById(idOrCode) {
  const store = await loadStore();
  return store.entries.find((entry) => entry.id === idOrCode || entry.shortCode === idOrCode) ?? null;
}

export async function ensureDailyBrief(snapshot, { force = false, now = new Date() } = {}) {
  const store = await loadStore();
  const window = dailyWindow(now);
  const existing = store.entries.find((entry) => entry.id === window.id);
  if (existing && !force) return existing;

  const article = buildDailyBriefArticle(snapshot, window);
  const entries = [article, ...store.entries.filter((entry) => entry.id !== article.id)]
    .sort((a, b) => new Date(b.windowEnd) - new Date(a.windowEnd))
    .slice(0, 60);
  await saveStore({ version: 1, entries, updatedAt: new Date().toISOString() });
  return article;
}

export function msUntilNextDailyRun(now = new Date()) {
  const current = now.getTime();
  const local = new Date(current + CST_OFFSET_MS);
  const nextLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 4, 0, 0, 0);
  const nextRun = nextLocal - CST_OFFSET_MS > current ? nextLocal - CST_OFFSET_MS : nextLocal + DAY_MS - CST_OFFSET_MS;
  return Math.max(1000, nextRun - current);
}

function buildDailyBriefArticle(snapshot, window) {
  const eventsInWindow = snapshot.events.filter((event) => {
    const seenAt = new Date(event.lastSeenAt).getTime();
    return seenAt >= new Date(window.windowStart).getTime() && seenAt < new Date(window.windowEnd).getTime();
  });
  const events = eventsInWindow.length ? eventsInWindow : snapshot.events.slice(0, 16);
  const selected = events.filter((event) => event.selected).slice(0, 12);
  const articleEvents = selected.length ? selected : events.slice(0, 12);
  const highlights = articleEvents.slice(0, 4).map(toBriefEvent);
  const categories = [...new Set(articleEvents.map((event) => event.category))];
  const sections = categories.map((category) => ({
    category,
    events: articleEvents.filter((event) => event.category === category).slice(0, 5).map(toBriefEvent)
  }));
  const shortCode = createHash("sha1").update(window.id).digest("hex").slice(0, 7);
  const topEntities = [...new Set(articleEvents.flatMap((event) => event.entities ?? []))].slice(0, 8);

  return {
    id: window.id,
    shortCode,
    shortPath: `/s/${shortCode}`,
    title: `${window.id} AI/科技日报`,
    subtitle: "04:00 自动汇总过去 24 小时的 AI 和科技热点",
    generatedAt: new Date().toISOString(),
    scheduledAt: window.windowEnd,
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
    eventCount: articleEvents.length,
    sourceCount: new Set(articleEvents.flatMap((event) => event.sourceIds ?? [])).size,
    lead: buildLead(articleEvents, topEntities),
    highlights,
    sections,
    watchList: (snapshot.dailyBrief?.watchList ?? []).slice(0, 4).map(toBriefEvent),
    tags: topEntities
  };
}

function buildLead(events, topEntities) {
  const top = events[0];
  if (!top) return "过去 24 小时暂未形成足够清晰的 AI/科技热点，建议稍后再看。";
  const topics = topEntities.slice(0, 4).join("、") || top.category;
  return `过去 24 小时，${topics} 是最值得关注的线索。头条事件是“${displayTitle(top)}”，它代表了今天 AI 产品、模型或开发者生态里的主要变化。`;
}

function toBriefEvent(event) {
  return {
    id: event.id,
    title: displayTitle(event),
    category: event.category,
    summary: event.editorSummary || event.summary,
    insight: event.editorInsight || event.editorSummary || event.summary,
    trustLabel: trustLabel(event),
    lastSeenAt: event.lastSeenAt,
    sourceCount: event.sources?.length ?? event.sourceIds?.length ?? 0,
    highTrustSourceCount: (event.sources ?? []).filter((source) => source.tier === "T1" || source.tier === "T1.5").length,
    primaryUrl: event.relatedItems?.[0]?.url ?? ""
  };
}

function trustLabel(event) {
  if (event.primaryTier === "T1" || event.confidence >= 74) return "高可信";
  if (event.platformCount >= 3) return "多源验证";
  if (event.status === "watch" || event.trend === "volatile") return "待验证";
  return "社区热议";
}

function displayTitle(event) {
  return cleanText(event.title, 90);
}

function cleanText(value, maxLength = 120) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function dailyWindow(now) {
  const local = new Date(now.getTime() + CST_OFFSET_MS);
  let endLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 4, 0, 0, 0);
  if (local.getUTCHours() < 4) endLocal -= DAY_MS;
  const endUtc = endLocal - CST_OFFSET_MS;
  const startUtc = endUtc - DAY_MS;
  const id = new Date(endLocal).toISOString().slice(0, 10);
  return {
    id,
    windowStart: withCstOffset(startUtc),
    windowEnd: withCstOffset(endUtc)
  };
}

function withCstOffset(utcMs) {
  const local = new Date(utcMs + CST_OFFSET_MS);
  return `${local.toISOString().slice(0, 19)}+08:00`;
}

async function loadStore() {
  try {
    const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
    return { version: 1, entries: Array.isArray(store.entries) ? store.entries : [] };
  } catch {
    return { version: 1, entries: [] };
  }
}

async function saveStore(store) {
  await mkdir(dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`);
}
