import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const DEFAULT_CACHE_PATH = fileURLToPath(new URL("../.cache/event-editorial.json", import.meta.url));
const CACHE_PATH = process.env.EDITORIAL_CACHE_PATH || DEFAULT_CACHE_PATH;
const DEFAULT_LIMIT = Number.POSITIVE_INFINITY;
const BATCH_SIZE = Number(process.env.AI_ENRICHMENT_BATCH_SIZE || 5);
const LLM_TIMEOUT_MS = Number(process.env.AI_ENRICHMENT_TIMEOUT_MS || 45000);
const LLM_MAX_ATTEMPTS = Number(process.env.AI_ENRICHMENT_MAX_ATTEMPTS || 2);
let cachedProxyUrl = "";
let cachedProxyDispatcher = null;

export async function applyEditorialEnrichment(snapshot, { allowLlm = false, force = false, limit = DEFAULT_LIMIT } = {}) {
  const cache = await loadCache();
  const entries = cache.entries ?? {};
  const missing = [];

  let events = snapshot.events.map((event, index) => {
    const key = editorialKey(event);
    const cached = !force ? entries[key] : null;
    const normalized = normalizeEditorial(event, cached ?? fallbackEditorial(event));
    const needsEditorial =
      !cached ||
      !hasRequiredEditorialFields(normalized) ||
      !hasMeaningfulBilingualText(event, normalized);
    if (index < limit && needsEditorial) {
      missing.push({ key, event });
    }
    return applyEditorialToEvent(event, normalized, key);
  });

  let generatedItems = [];
  let llmErrors = [];
  if (allowLlm && missing.length && isLlmConfigured()) {
    const result = await generateEditorialBatches(missing).catch((error) => {
      llmErrors = [formatLlmError(error)];
      return { generated: [], errors: llmErrors };
    });
    generatedItems = result.generated ?? [];
    llmErrors = result.errors ?? llmErrors;
    if (generatedItems.length) {
      for (const item of generatedItems) {
        entries[item.key] = normalizeGeneratedEditorial(item);
      }
      await saveCache({ ...cache, entries, updatedAt: new Date().toISOString() });
      events = snapshot.events.map((event) => {
        const key = editorialKey(event);
        return applyEditorialToEvent(event, normalizeEditorial(event, entries[key] ?? fallbackEditorial(event)), key);
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
        llmUsedThisRun: generatedItems.length > 0,
        llmError: llmErrors.join(" | ").slice(0, 1200),
        llmGeneratedItems: generatedItems.length,
        llmMissingItems: missing.length,
        enrichedTopLimit: Number.isFinite(limit) ? limit : events.length,
        translatedItems: events.filter((event) => hasMeaningfulBilingualText(event, normalizeEditorial(event, { translations: event.translations }))).length
      }
    }
  };
}

function applyEditorialToEvent(event, editorial, key) {
  const normalized = normalizeEditorial(event, editorial);
  return {
    ...event,
    editorialKey: key,
    editorTitle: normalized.translations.zh.title || event.title,
    editorSummary: normalized.translations.zh.summary || readableSummary(event),
    editorInsight: normalized.translations.zh.insight || "",
    editorDetail: normalized.translations.zh.detail || readableDetail(event, normalized.translations.zh.summary),
    editorBullets: cleanBullets(normalized.translations.zh.bullets, 3).length
      ? cleanBullets(normalized.translations.zh.bullets, 3)
      : readableBullets(event),
    translations: normalized.translations,
    editorialSource: normalized.source || "source"
  };
}

function fallbackEditorial(event) {
  const summary = readableSummary(event);
  const bullets = readableBullets(event);
  return {
    title: event.title,
    summary,
    insight: "",
    detail: readableDetail(event, summary),
    bullets,
    source: "source"
  };
}

function normalizeGeneratedEditorial(item) {
  return {
    translations: {
      zh: {
        title: cleanLine(item.title_zh || item.titleZh || item.title || "", 120),
        summary: cleanLine(item.summary_zh || item.summaryZh || item.summary || "", 160),
        insight: cleanLine(item.insight_zh || item.insightZh || item.insight || "", 110),
        detail: cleanLine(item.detail_zh || item.detailZh || item.detail || "", 320),
        bullets: cleanBullets(item.bullets_zh || item.bulletsZh || item.bullets, 3)
      },
      en: {
        title: cleanLine(item.title_en || item.titleEn || item.title || "", 140),
        summary: cleanLine(item.summary_en || item.summaryEn || item.summary || "", 190),
        insight: cleanLine(item.insight_en || item.insightEn || item.insight || "", 130),
        detail: cleanLine(item.detail_en || item.detailEn || item.detail || "", 360),
        bullets: cleanBullets(item.bullets_en || item.bulletsEn || item.bullets, 3)
      }
    },
    summary: cleanLine(item.summary_zh || item.summaryZh || item.summary || "", 160),
    insight: cleanLine(item.insight_zh || item.insightZh || item.insight || "", 110),
    detail: cleanLine(item.detail_zh || item.detailZh || item.detail || "", 320),
    bullets: cleanBullets(item.bullets_zh || item.bulletsZh || item.bullets, 3),
    source: "llm-cache",
    createdAt: new Date().toISOString()
  };
}

function normalizeEditorial(event, editorial = {}) {
  const legacySummary = editorial.summary || readableSummary(event);
  const legacyInsight = editorial.insight || "";
  const legacyDetail = editorial.detail || readableDetail(event, legacySummary);
  const legacyBullets = cleanBullets(editorial.bullets, 3).length ? cleanBullets(editorial.bullets, 3) : readableBullets(event);
  const zh = editorial.translations?.zh ?? {};
  const en = editorial.translations?.en ?? {};

  return {
    ...editorial,
    source: editorial.source || "source",
    translations: {
      zh: {
        title: cleanLine(zh.title || editorial.titleZh || editorial.title_zh || editorial.title || event.title, 120),
        summary: cleanLine(zh.summary || editorial.summaryZh || editorial.summary_zh || legacySummary, 160),
        insight: cleanLine(zh.insight || editorial.insightZh || editorial.insight_zh || legacyInsight, 110),
        detail: cleanLine(zh.detail || editorial.detailZh || editorial.detail_zh || legacyDetail, 320),
        bullets: cleanBullets(zh.bullets || editorial.bulletsZh || editorial.bullets_zh || legacyBullets, 3)
      },
      en: {
        title: cleanLine(en.title || editorial.titleEn || editorial.title_en || event.title, 140),
        summary: cleanLine(en.summary || editorial.summaryEn || editorial.summary_en || legacySummary, 190),
        insight: cleanLine(en.insight || editorial.insightEn || editorial.insight_en || legacyInsight, 130),
        detail: cleanLine(en.detail || editorial.detailEn || editorial.detail_en || legacyDetail, 360),
        bullets: cleanBullets(en.bullets || editorial.bulletsEn || editorial.bullets_en || legacyBullets, 3)
      }
    }
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
  const errors = [];
  for (let index = 0; index < items.length; index += BATCH_SIZE) {
    const batch = items.slice(index, index + BATCH_SIZE);
    try {
      generated.push(...(await generateEditorialBatch(batch)));
    } catch (error) {
      errors.push(`batch ${index + 1}-${index + batch.length}: ${formatLlmError(error)}`);
      if (batch.length === 1) continue;
      for (const item of batch) {
        try {
          generated.push(...(await generateEditorialBatch([item])));
        } catch (singleError) {
          errors.push(`single ${item.key}: ${formatLlmError(singleError)}`);
        }
      }
    }
  }
  return { generated, errors };
}

async function generateEditorialBatch(items) {
  const llm = getLlmConfig();
  const response = await fetchLlmWithRetry(`${llm.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llm.apiKey}`
    },
    body: JSON.stringify({
      model: llm.model,
      temperature: 0.2,
      max_tokens: items.length > 1 ? Math.min(900 + items.length * 1100, 7000) : 2200,
      messages: [
        {
          role: "system",
          content:
            "你是 AI/科技新闻编辑和双语翻译。只基于输入信息写中英文卡片文案，不编造事实，不夸张，不写营销口吻。返回严格 JSON。"
        },
        {
          role: "user",
          content: JSON.stringify({
            instruction:
              "为每个事件生成适合首页 feed 和详情页的双语编辑文案。title_zh/title_en 是可读标题；summary_zh 60-120字、summary_en 35-70 words，说明发生了什么；insight_zh 25-70字、insight_en 14-35 words，说明为什么重要；detail_zh 120-260字、detail_en 70-150 words，整合已有来源里能确定的内容；bullets_zh/bullets_en 各给2-3条短要点。只基于输入，不编造金额、时间、机构关系。不要写“目前仍是单源信号”这类系统判断。输出格式：{\"items\":[{\"key\":\"...\",\"title_zh\":\"...\",\"title_en\":\"...\",\"summary_zh\":\"...\",\"summary_en\":\"...\",\"insight_zh\":\"...\",\"insight_en\":\"...\",\"detail_zh\":\"...\",\"detail_en\":\"...\",\"bullets_zh\":[\"...\"],\"bullets_en\":[\"...\"]}]}",
            events: items.map(({ key, event }) => ({
              key,
              title: event.title,
              category: event.category,
              sourceCount: event.sources?.length ?? event.sourceIds?.length ?? 0,
              sourceNames: event.sources?.map((source) => source.name).slice(0, 4) ?? [],
              snippets: event.relatedItems?.slice(0, 3).map((item) => ({
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
    const errorText = cleanLine(await response.text(), 220);
    throw new Error(`Editorial LLM request failed: ${response.status}${errorText ? ` ${errorText}` : ""}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  const parsed = parseJsonObject(text);
  return Array.isArray(parsed.items)
    ? parsed.items.filter((item) => item.key && (item.summary_zh || item.summaryZh || item.summary || item.summary_en || item.summaryEn))
    : [];
}

function hasRequiredEditorialFields(editorial) {
  return Boolean(
    editorial.translations.zh.title &&
      editorial.translations.en.title &&
      editorial.translations.zh.summary &&
      editorial.translations.en.summary &&
      editorial.translations.zh.detail &&
      editorial.translations.en.detail &&
      cleanBullets(editorial.translations.zh.bullets, 3).length &&
      cleanBullets(editorial.translations.en.bullets, 3).length
  );
}

function hasMeaningfulBilingualText(event, editorial) {
  const zh = editorial.translations.zh;
  const en = editorial.translations.en;
  const sourceText = [event.title, event.summary, ...(event.relatedItems ?? []).map((item) => `${item.title} ${item.summary}`)].join(" ");
  const zhText = [zh.title, zh.summary, zh.detail, ...(zh.bullets ?? [])].join(" ");
  const enText = [en.title, en.summary, en.detail, ...(en.bullets ?? [])].join(" ");
  const sourceLooksChinese = hasHan(sourceText);
  const sourceLooksEnglish = !sourceLooksChinese && /[A-Za-z]{4,}/.test(sourceText);

  if (sourceLooksEnglish && !hasHan(zhText)) return false;
  if (sourceLooksChinese && !/[A-Za-z]{4,}/.test(enText)) return false;
  if (normalize([zh.summary, zh.detail].join(" ")) === normalize([en.summary, en.detail].join(" "))) return false;
  if (sourceLooksEnglish && normalize([zh.title, zh.summary].join(" ")) === normalize([event.title, event.summary].join(" "))) return false;
  return true;
}

function hasHan(value) {
  return /\p{Script=Han}/u.test(String(value ?? ""));
}

async function fetchLlmWithRetry(url, options) {
  let lastError = null;
  for (let attempt = 1; attempt <= LLM_MAX_ATTEMPTS; attempt += 1) {
    try {
      const dispatcher = getProxyDispatcher(url);
      return await undiciFetch(url, {
        ...options,
        ...(dispatcher ? { dispatcher } : {}),
        signal: AbortSignal.timeout(LLM_TIMEOUT_MS)
      });
    } catch (error) {
      lastError = error;
      if (attempt < LLM_MAX_ATTEMPTS) {
        await delay(900 * attempt);
      }
    }
  }
  throw lastError;
}

function getProxyDispatcher(targetUrl) {
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy ||
    "";
  if (!proxyUrl) return null;

  const hostname = new URL(targetUrl).hostname;
  if (shouldBypassProxy(hostname)) return null;

  if (proxyUrl !== cachedProxyUrl) {
    cachedProxyUrl = proxyUrl;
    cachedProxyDispatcher = new ProxyAgent(proxyUrl);
  }
  return cachedProxyDispatcher;
}

function shouldBypassProxy(hostname) {
  const noProxy = process.env.NO_PROXY || process.env.no_proxy || "";
  if (!noProxy) return false;
  const normalizedHost = hostname.toLowerCase();
  return noProxy
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .some((entry) => entry === "*" || normalizedHost === entry || (entry.startsWith(".") && normalizedHost.endsWith(entry)) || normalizedHost.endsWith(`.${entry}`));
}

function formatLlmError(error) {
  return [error?.name, error?.message, error?.cause?.code, error?.cause?.message].filter(Boolean).join(": ");
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
    return { version: 2, entries: {} };
  }
}

async function saveCache(cache) {
  await mkdir(dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
}

function parseJsonObject(text) {
  const stripped = String(text).replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  const cleaned = start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped;
  return JSON.parse(cleaned);
}

function isLlmConfigured() {
  const config = getLlmConfig();
  return Boolean(config.baseUrl && config.apiKey && config.model);
}

function getLlmConfig() {
  return {
    baseUrl: process.env.LLM_BASE_URL || process.env.SF_BASE_URL || "",
    apiKey: process.env.LLM_API_KEY || process.env.SF_API_KEY || "",
    model: process.env.LLM_MODEL || process.env.SF_MODEL || "deepseek-chat"
  };
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

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}
