import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CACHE_PATH = fileURLToPath(new URL("../.cache/event-editorial.json", import.meta.url));
const DEFAULT_LIMIT = 12;
const BATCH_SIZE = 4;

export async function applyEditorialEnrichment(snapshot, { allowLlm = false, force = false, limit = DEFAULT_LIMIT } = {}) {
  const cache = await loadCache();
  const entries = cache.entries ?? {};
  const missing = [];

  let events = snapshot.events.map((event, index) => {
    const key = editorialKey(event);
    const cached = !force ? entries[key] : null;
    const needsEditorial = !cached || !cached.detail || !cleanBullets(cached.bullets, 3).length;
    if (index < limit && needsEditorial) {
      missing.push({ key, event });
    }
    return applyEditorialToEvent(event, cached ?? fallbackEditorial(event), key);
  });

  let llmError = "";
  if (allowLlm && missing.length && isLlmConfigured()) {
    const generated = await generateEditorialBatches(missing).catch((error) => {
      llmError = error.message;
      return [];
    });
    if (generated.length) {
      for (const item of generated) {
        entries[item.key] = {
          summary: cleanLine(item.summary, 120),
          insight: cleanLine(item.insight, 80),
          detail: cleanLine(item.detail, 260),
          bullets: cleanBullets(item.bullets, 3),
          source: "llm-cache",
          createdAt: new Date().toISOString()
        };
      }
      await saveCache({ ...cache, entries, updatedAt: new Date().toISOString() });
      events = snapshot.events.map((event) => {
        const key = editorialKey(event);
        return applyEditorialToEvent(event, entries[key] ?? fallbackEditorial(event), key);
      });
    }
  }

  return {
    ...snapshot,
    events,
    dailyBrief: {
      ...snapshot.dailyBrief,
      sections: snapshot.dailyBrief.sections.map((section) => ({
        ...section,
        events: section.events.map((event) => events.find((item) => item.id === event.id) ?? event)
      })),
      risingEvents: snapshot.dailyBrief.risingEvents.map((event) => events.find((item) => item.id === event.id) ?? event),
      coolingEvents: snapshot.dailyBrief.coolingEvents.map((event) => events.find((item) => item.id === event.id) ?? event),
      watchList: snapshot.dailyBrief.watchList.map((event) => events.find((item) => item.id === event.id) ?? event)
    },
    diagnostics: {
      ...snapshot.diagnostics,
      editorial: {
        cachedItems: Object.keys(entries).length,
        llmConfigured: isLlmConfigured(),
        llmUsedThisRun: Boolean(allowLlm && missing.length && !llmError),
        llmError,
        enrichedTopLimit: limit
      }
    }
  };
}

function applyEditorialToEvent(event, editorial, key) {
  return {
    ...event,
    editorialKey: key,
    editorSummary: editorial.summary || readableSummary(event),
    editorInsight: editorial.insight || "",
    editorDetail: editorial.detail || readableDetail(event, editorial.summary),
    editorBullets: cleanBullets(editorial.bullets, 3).length ? cleanBullets(editorial.bullets, 3) : readableBullets(event),
    editorialSource: editorial.source || "source"
  };
}

function fallbackEditorial(event) {
  return {
    summary: readableSummary(event),
    insight: "",
    source: "source"
  };
}

function readableSummary(event) {
  const summary = cleanLine(event.summary, 140);
  if (summary && normalize(summary) !== normalize(event.title)) return summary;
  const related = event.relatedItems?.find((item) => normalize(item.summary) !== normalize(item.title));
  return cleanLine(related?.summary || event.title, 140);
}

function readableDetail(event, generatedSummary) {
  const parts = [generatedSummary || readableSummary(event), ...readableBullets(event)]
    .map((item) => cleanLine(item, 160))
    .filter(Boolean);
  return cleanLine(dedupe(parts).join(" "), 260);
}

function readableBullets(event) {
  const candidates = [
    event.editorInsight,
    ...(event.relatedItems ?? []).flatMap((item) => [item.summary, item.title])
  ];
  return dedupe(
    candidates
      .map((item) => cleanLine(item, 130))
      .filter((item) => item && normalize(item) !== normalize(event.title) && normalize(item) !== normalize(event.summary))
  ).slice(0, 3);
}

async function generateEditorialBatches(items) {
  const generated = [];
  for (let index = 0; index < items.length; index += BATCH_SIZE) {
    generated.push(...(await generateEditorialBatch(items.slice(index, index + BATCH_SIZE))));
  }
  return generated;
}

async function generateEditorialBatch(items) {
  const response = await fetch(`${process.env.LLM_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LLM_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "你是 AI/科技新闻编辑。只基于输入信息写中文卡片文案，不编造事实，不夸张，不写营销口吻。返回 JSON。"
        },
        {
          role: "user",
          content: JSON.stringify({
            instruction:
              "为每个事件生成适合首页卡片和详情页的中文编辑文案。summary 60-110字，说明发生了什么；insight 25-55字，说明读者该关注什么；detail 120-220字，整合已有来源里能确定的内容；bullets 给2-3条短要点。只基于输入，不编造金额、时间、机构关系。不要写“目前仍是单源信号”这类系统判断。输出格式：{\"items\":[{\"key\":\"...\",\"summary\":\"...\",\"insight\":\"...\",\"detail\":\"...\",\"bullets\":[\"...\",\"...\"]}]}",
            events: items.map(({ key, event }) => ({
              key,
              title: event.title,
              category: event.category,
              sourceCount: event.sources?.length ?? event.sourceIds?.length ?? 0,
              sourceNames: event.sources?.map((source) => source.name).slice(0, 4) ?? [],
              snippets: event.relatedItems?.slice(0, 4).map((item) => ({
                title: item.title,
                summary: cleanLine(item.summary, 180),
                source: item.platform,
                originalSource: item.originalSource,
                url: item.url
              }))
            }))
          })
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Editorial LLM request failed: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  const parsed = parseJsonObject(text);
  return Array.isArray(parsed.items) ? parsed.items.filter((item) => item.key && item.summary) : [];
}

function editorialKey(event) {
  const basis = [
    event.title,
    event.category,
    event.relatedItems?.map((item) => `${item.url}:${item.publishedAt}`).join("|") || event.relatedItemIds?.join("|")
  ].join("::");
  return createHash("sha1").update(basis).digest("hex").slice(0, 16);
}

async function loadCache() {
  try {
    return JSON.parse(await readFile(CACHE_PATH, "utf8"));
  } catch {
    return { version: 1, entries: {} };
  }
}

async function saveCache(cache) {
  await mkdir(dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
}

function parseJsonObject(text) {
  const cleaned = String(text).replace(/^```json\s*|\s*```$/g, "").trim();
  return JSON.parse(cleaned);
}

function isLlmConfigured() {
  return Boolean(process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL);
}

function cleanLine(value, maxLength) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/https?\s*[：:]\s*\/\/\S+/gi, "")
    .trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function cleanBullets(value, maxLength = 3) {
  return dedupe(
    (Array.isArray(value) ? value : [])
      .map((item) => cleanLine(item, 120))
      .filter(Boolean)
  ).slice(0, maxLength);
}

function dedupe(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const key = normalize(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}
