import { createHash } from "node:crypto";
import { rules as defaultRules } from "./mockData.js";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36 ai-hot-radar/0.1";

const MAX_ITEMS_PER_SOURCE = 12;
const REQUEST_TIMEOUT_MS = 16000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_FETCH_ATTEMPTS = 3;

let cachedDataset = null;
let pendingDataset = null;

export const liveSourceConfigs = [
  {
    id: "live-aihot-selected",
    name: "AI HOT Selected",
    url: "https://aihot.virxact.com/api/public/items?mode=selected&take=40",
    parser: "aihot",
    platform: "AIHOT",
    tier: "T1.5",
    type: "aggregator",
    owner: "AI HOT",
    weight: 1.08,
    category: "行业动态"
  },
  {
    id: "live-aihot-all",
    name: "AI HOT All",
    url: "https://aihot.virxact.com/api/public/items?mode=all&take=40",
    parser: "aihot",
    platform: "AIHOT",
    tier: "T2",
    type: "aggregator",
    owner: "AI HOT",
    weight: 0.98,
    category: "行业动态"
  },
  {
    id: "live-openai-news",
    name: "OpenAI News",
    url: "https://openai.com/news/rss.xml",
    parser: "rss",
    platform: "RSS",
    tier: "T1",
    type: "official_blog",
    owner: "OpenAI",
    weight: 1.25,
    category: "模型发布"
  },
  {
    id: "live-google-ai",
    name: "Google AI Blog",
    url: "https://blog.google/technology/ai/rss/",
    parser: "rss",
    platform: "RSS",
    tier: "T1",
    type: "official_blog",
    owner: "Google",
    weight: 1.18,
    category: "模型发布"
  },
  {
    id: "live-huggingface-blog",
    name: "Hugging Face Blog",
    url: "https://huggingface.co/blog/feed.xml",
    parser: "rss",
    platform: "RSS",
    tier: "T1.5",
    type: "official_blog",
    owner: "Hugging Face",
    weight: 1.1,
    category: "开源生态"
  },
  {
    id: "live-github-blog-ai",
    name: "GitHub Blog AI",
    url: "https://github.blog/tag/ai/feed/",
    parser: "rss",
    platform: "RSS",
    tier: "T1.5",
    type: "official_blog",
    owner: "GitHub",
    weight: 1.06,
    category: "产品更新"
  },
  {
    id: "live-latent-space",
    name: "Latent Space",
    url: "https://www.latent.space/feed",
    parser: "rss",
    platform: "Newsletter",
    tier: "T2",
    type: "newsletter",
    owner: "Latent Space",
    weight: 0.94,
    category: "技巧与观点"
  },
  {
    id: "live-the-decoder",
    name: "The Decoder",
    url: "https://the-decoder.com/feed/",
    parser: "rss",
    platform: "RSS",
    tier: "T2",
    type: "media",
    owner: "The Decoder",
    weight: 0.92,
    category: "行业动态"
  },
  {
    id: "live-venturebeat-ai",
    name: "VentureBeat AI",
    url: "https://venturebeat.com/category/ai/feed/",
    parser: "rss",
    platform: "RSS",
    tier: "T2",
    type: "media",
    owner: "VentureBeat",
    weight: 0.9,
    category: "行业动态"
  },
  {
    id: "live-techcrunch-ai",
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    parser: "rss",
    platform: "RSS",
    tier: "T2",
    type: "media",
    owner: "TechCrunch",
    weight: 0.9,
    category: "行业动态"
  },
  {
    id: "live-verge-ai",
    name: "The Verge AI",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    parser: "rss",
    platform: "RSS",
    tier: "T2",
    type: "media",
    owner: "The Verge",
    weight: 0.9,
    category: "行业动态"
  },
  {
    id: "live-marktechpost",
    name: "MarkTechPost",
    url: "https://www.marktechpost.com/feed/",
    parser: "rss",
    platform: "RSS",
    tier: "T2",
    type: "media",
    owner: "MarkTechPost",
    weight: 0.86,
    category: "论文研究"
  },
  {
    id: "live-arxiv-ai",
    name: "arXiv AI/ML/CL",
    url: "https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.CL+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=20",
    parser: "atom",
    platform: "arXiv",
    tier: "T1.5",
    type: "paper",
    owner: "arXiv",
    weight: 1.03,
    category: "论文研究"
  },
  {
    id: "live-hn-ai",
    name: "Hacker News AI",
    url: "https://hn.algolia.com/api/v1/search_by_date?query=AI&tags=story&hitsPerPage=25",
    parser: "hn",
    platform: "HN",
    tier: "T2",
    type: "community",
    owner: "Hacker News",
    weight: 0.92,
    category: "技巧与观点"
  },
  githubReleaseSource("live-github-openai-python", "OpenAI Python Releases", "openai/openai-python", "OpenAI", "T1.5"),
  githubReleaseSource(
    "live-github-openai-agents-python",
    "OpenAI Agents Python Releases",
    "openai/openai-agents-python",
    "OpenAI",
    "T1.5"
  ),
  githubReleaseSource("live-github-langchain", "LangChain Releases", "langchain-ai/langchain", "LangChain", "T1.5"),
  githubReleaseSource("live-github-transformers", "Transformers Releases", "huggingface/transformers", "Hugging Face", "T1.5"),
  githubReleaseSource("live-github-ollama", "Ollama Releases", "ollama/ollama", "Ollama", "T1.5"),
  githubReleaseSource("live-github-vllm", "vLLM Releases", "vllm-project/vllm", "vLLM", "T1.5"),
  githubReleaseSource("live-github-llama-cpp", "llama.cpp Releases", "ggml-org/llama.cpp", "ggml-org", "T1.5"),
  githubReleaseSource(
    "live-github-mcp-servers",
    "MCP Servers Releases",
    "modelcontextprotocol/servers",
    "Model Context Protocol",
    "T1.5"
  ),
  {
    id: "live-youtube-openai",
    name: "OpenAI YouTube",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCXZCJLdBC09xxGZ6gcdrc6A",
    parser: "atom",
    platform: "YouTube",
    tier: "T1.5",
    type: "video",
    owner: "OpenAI",
    weight: 0.98,
    category: "产品更新"
  },
  {
    id: "live-youtube-deepmind",
    name: "Google DeepMind YouTube",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCP7jMXSY2xbc3KCAE0MHQ-A",
    parser: "atom",
    platform: "YouTube",
    tier: "T1.5",
    type: "video",
    owner: "Google DeepMind",
    weight: 0.98,
    category: "产品更新"
  },
  {
    id: "live-youtube-two-minute-papers",
    name: "Two Minute Papers YouTube",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCbfYPyITQ-7l4upoX8nvctg",
    parser: "atom",
    platform: "YouTube",
    tier: "T2",
    type: "video",
    owner: "Two Minute Papers",
    weight: 0.88,
    category: "论文研究"
  }
];

function githubReleaseSource(id, name, repo, owner, tier) {
  return {
    id,
    name,
    url: `https://github.com/${repo}/releases.atom`,
    parser: "atom",
    platform: "GitHub",
    tier,
    type: "repo_release",
    owner,
    weight: 1.02,
    category: "开源生态",
    repo
  };
}

export async function fetchLiveData({ force = false } = {}) {
  const startedAt = Date.now();
  const results = await mapWithConcurrency(liveSourceConfigs, 6, fetchSource);
  const successfulResults = results.filter((result) => result.ok && result.items.length);
  const sources = results.map((result) => toRuntimeSource(result.config, result));
  const rawItems = dedupeRawItems(successfulResults.flatMap((result) => result.items)).slice(0, 220);
  const events = buildEventsFromRawItems(rawItems, sources).slice(0, 80);
  const finishedAt = new Date().toISOString();
  const failedCount = results.length - successfulResults.length;

  return {
    events,
    sources,
    rawItems,
    rules: {
      ...defaultRules,
      categoryBoosts: {
        ...defaultRules.categoryBoosts,
        论文研究: 2,
        技巧与观点: 1
      }
    },
    jobs: [
      {
        id: "job-live-ingest",
        name: force ? "强制真实抓取" : "真实抓取",
        status: successfulResults.length >= 20 ? "ok" : "warning",
        lastRunAt: finishedAt,
        durationMs: Date.now() - startedAt,
        result: `${successfulResults.length}/${results.length} 个信源抓取成功，${rawItems.length} 条 raw item`
      },
      {
        id: "job-live-cluster",
        name: "事件聚类",
        status: events.length ? "ok" : "warning",
        lastRunAt: finishedAt,
        durationMs: Math.max(1, Math.round((Date.now() - startedAt) * 0.18)),
        result: `${rawItems.length} 条信号聚成 ${events.length} 个事件`
      },
      {
        id: "job-live-score",
        name: "重新计分",
        status: events.length ? "ok" : "warning",
        lastRunAt: finishedAt,
        durationMs: Math.max(1, Math.round((Date.now() - startedAt) * 0.08)),
        result: `${events.length} 个真实事件进入热度和精选分模型`
      },
      {
        id: "job-live-source-health",
        name: "信源健康",
        status: failedCount ? "warning" : "ok",
        lastRunAt: finishedAt,
        durationMs: 0,
        result: failedCount ? `${failedCount} 个信源失败，页面仍使用成功信源` : "全部信源抓取成功"
      }
    ],
    diagnostics: {
      generatedAt: finishedAt,
      sourceCount: sources.length,
      successfulSourceCount: successfulResults.length,
      failedSourceCount: failedCount,
      rawItemCount: rawItems.length,
      eventCount: events.length,
      sourceResults: results.map((result) => ({
        id: result.config.id,
        name: result.config.name,
        ok: isUsableResult(result),
        status: result.status,
        itemCount: result.items.length,
        error: result.error
      }))
    }
  };
}

export async function getLiveDataset({ force = false } = {}) {
  const now = Date.now();
  if (!force && cachedDataset && now - cachedDataset.cachedAt < CACHE_TTL_MS) {
    return cachedDataset.dataset;
  }
  if (!force && pendingDataset) {
    return pendingDataset;
  }

  pendingDataset = fetchLiveData({ force }).then((dataset) => {
    cachedDataset = {
      cachedAt: Date.now(),
      dataset
    };
    return dataset;
  });

  try {
    return await pendingDataset;
  } finally {
    pendingDataset = null;
  }
}

async function fetchSource(config) {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: acceptHeader(config.parser)
  };
  const startedAt = Date.now();
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(config.url, {
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
      const text = await response.text();
      if (!response.ok) {
        lastError = text.slice(0, 160);
        if (response.status >= 500 && attempt < MAX_FETCH_ATTEMPTS) {
          await delay(350 * attempt);
          continue;
        }
        return { ok: false, config, status: response.status, items: [], durationMs: Date.now() - startedAt, error: lastError };
      }
      const items = parseByConfig(config, text).slice(0, MAX_ITEMS_PER_SOURCE);
      return { ok: true, config, status: response.status, items, durationMs: Date.now() - startedAt, error: "" };
    } catch (error) {
      lastError = error.message;
      if (attempt < MAX_FETCH_ATTEMPTS) {
        await delay(350 * attempt);
        continue;
      }
    }
  }

  return {
    ok: false,
    config,
    status: "ERR",
    items: [],
    durationMs: Date.now() - startedAt,
    error: lastError
  };
}

function parseByConfig(config, text) {
  if (config.parser === "aihot") return parseAihotItems(config, JSON.parse(text));
  if (config.parser === "hn") return parseHnItems(config, JSON.parse(text));
  if (config.parser === "github-releases") return parseGithubReleases(config, JSON.parse(text));
  return parseXmlFeed(config, text);
}

function parseAihotItems(config, data) {
  return (data.items ?? []).map((item) =>
    normalizeRawItem(config, {
      externalId: item.id,
      title: item.title,
      summary: item.summary || item.title_en || "",
      url: item.url,
      publishedAt: item.publishedAt,
      category: mapAihotCategory(item.category),
      engagement: 1600,
      originalSource: item.source,
      entities: extractEntities(`${item.title} ${item.summary ?? ""}`)
    })
  );
}

function parseHnItems(config, data) {
  return (data.hits ?? [])
    .filter((item) => item.title && item.url)
    .filter((item) => isAiRelevant(`${item.title} ${item.story_text ?? ""} ${item.url ?? ""}`))
    .map((item) =>
      normalizeRawItem(config, {
        externalId: item.objectID,
        title: item.title,
        summary: item.story_text || item.title,
        url: item.url,
        publishedAt: item.created_at,
        category: inferCategory(`${item.title} ${item.story_text ?? ""}`, config.category),
        engagement: (item.points ?? 0) * 18 + (item.num_comments ?? 0) * 28,
        originalSource: `HN points ${item.points ?? 0}`,
        entities: extractEntities(item.title)
      })
    );
}

function parseGithubReleases(config, data) {
  if (!Array.isArray(data)) return [];
  return data.map((release) =>
    normalizeRawItem(config, {
      externalId: release.id || release.tag_name,
      title: `${config.repo} ${release.name || release.tag_name}`,
      summary: stripHtml(release.body || `${config.repo} 发布 ${release.tag_name}`),
      url: release.html_url,
      publishedAt: release.published_at || release.created_at,
      category: "开源生态",
      engagement: 1800,
      originalSource: config.repo,
      entities: extractEntities(`${config.repo} ${release.name ?? ""}`)
    })
  );
}

function parseXmlFeed(config, xml) {
  const itemBlocks = extractBlocks(xml, "item");
  if (itemBlocks.length) {
    return itemBlocks.map((block) =>
      normalizeRawItem(config, {
        externalId: tagText(block, "guid") || tagText(block, "link") || tagText(block, "title"),
        title: tagText(block, "title"),
        summary: tagText(block, "description") || tagText(block, "content:encoded"),
        url: tagText(block, "link"),
        publishedAt: tagText(block, "pubDate") || tagText(block, "dc:date"),
        category: inferCategory(`${tagText(block, "title")} ${tagText(block, "description")}`, config.category),
        engagement: 1000,
        originalSource: tagText(block, "author") || config.name,
        entities: extractEntities(tagText(block, "title"))
      })
    );
  }

  return extractBlocks(xml, "entry").map((block) =>
    normalizeRawItem(config, {
      externalId: tagText(block, "id") || firstHref(block) || tagText(block, "title"),
      title: config.repo ? `${config.repo} ${tagText(block, "title")}` : tagText(block, "title"),
      summary: tagText(block, "summary") || tagText(block, "media:description"),
      url: firstHref(block),
      publishedAt: tagText(block, "published") || tagText(block, "updated"),
      category: inferCategory(`${tagText(block, "title")} ${tagText(block, "summary")}`, config.category),
      engagement: 1000,
      originalSource: tagText(block, "author") || config.name,
      entities: extractEntities(tagText(block, "title"))
    })
  );
}

function normalizeRawItem(config, item) {
  const title = cleanText(item.title) || config.name;
  const summary = cleanText(item.summary || title);
  const url = item.url || config.url;
  const publishedAt = parseDate(item.publishedAt);
  const id = `raw-${config.id}-${shortHash(item.externalId || url || title)}`;
  return {
    id,
    sourceId: config.id,
    platform: config.platform,
    title,
    summary: summary.slice(0, 520),
    url,
    publishedAt,
    engagement: Math.max(40, Math.round(Number(item.engagement) || 1000)),
    category: item.category || config.category,
    originalSource: item.originalSource || config.name,
    entities: item.entities?.length ? item.entities : extractEntities(title)
  };
}

function toRuntimeSource(config, result) {
  const usable = isUsableResult(result);
  return {
    id: config.id,
    name: config.name,
    platform: config.platform,
    tier: config.tier,
    type: config.type,
    owner: config.owner,
    enabled: true,
    weight: config.weight,
    latencyMin: Math.max(1, Math.round((result.durationMs || 1000) / 1000)),
    items24h: result.items.length,
    url: config.url,
    lastFetchStatus: usable ? "ok" : result.ok ? "empty" : "failed",
    lastFetchHttpStatus: result.status,
    lastFetchError: result.error || ""
  };
}

function isUsableResult(result) {
  return Boolean(result.ok && result.items.length);
}

function buildEventsFromRawItems(rawItems, sources) {
  const sourceById = Object.fromEntries(sources.map((source) => [source.id, source]));
  const groups = new Map();
  for (const item of rawItems) {
    const key = clusterKey(item);
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  }

  return [...groups.entries()].map(([key, items]) => {
    const sorted = [...items].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    const primary = choosePrimaryItem(sorted, sourceById);
    const sourceIds = [...new Set(sorted.map((item) => item.sourceId))];
    const platforms = new Set(sorted.map((item) => item.platform));
    const sourceCredibility = sourceIds
      .map((id) => sourceById[id])
      .filter(Boolean)
      .reduce((sum, source) => sum + (source.tier === "T1" ? 88 : source.tier === "T1.5" ? 76 : 62), 0);
    const credibility = Math.round(sourceCredibility / Math.max(1, sourceIds.length));
    const category = primary.category || mostCommon(sorted.map((item) => item.category)) || "行业动态";
    const entities = [...new Set(sorted.flatMap((item) => item.entities || []))].slice(0, 5);
    const engagement = sorted.reduce((sum, item) => sum + item.engagement, 0);
    const mentions24h = Math.max(sorted.length, Math.round(sorted.length + engagement / 3800));
    const mentions6h = Math.max(1, Math.round(mentions24h * recencyVelocity(sorted)));
    const firstSeenAt = sorted.reduce((min, item) => (new Date(item.publishedAt) < new Date(min) ? item.publishedAt : min), sorted[0].publishedAt);
    const lastSeenAt = sorted[0].publishedAt;

    return {
      id: `evt-${shortHash(key)}`,
      title: primary.title,
      category,
      entities: entities.length ? entities : [sourceById[primary.sourceId]?.owner || primary.platform],
      summary: primary.summary || primary.title,
      whyItMatters: whyItMatters(primary, category, sourceIds.length, platforms.size),
      firstSeenAt,
      lastSeenAt,
      status: sourceIds.length >= 2 || credibility >= 76 ? "published" : "watch",
      trend: inferTrend(sorted),
      baseScores: {
        importance: scoreImportance(category, sourceIds.length, platforms.size),
        novelty: scoreNovelty(lastSeenAt),
        actionability: scoreActionability(category, primary),
        credibility,
        audienceFit: scoreAudienceFit(primary, category)
      },
      sourceIds,
      relatedItemIds: sorted.map((item) => item.id),
      metrics: {
        mentions24h,
        mentions6h,
        views: Math.max(1000, engagement * 80),
        comments: Math.round(engagement / 38),
        reposts: Math.round(engagement / 24),
        likes: Math.round(engagement / 8)
      }
    };
  });
}

function clusterKey(item) {
  const entities = (item.entities || []).filter((entity) => entity.length > 1).slice(0, 3);
  if (entities.length) return normalizeKey(`${item.category} ${entities.join(" ")}`);
  return normalizeKey(item.title)
    .split("-")
    .filter((token) => !STOPWORDS.has(token))
    .slice(0, 7)
    .join("-");
}

function choosePrimaryItem(items, sourceById) {
  return [...items].sort((a, b) => {
    const sourceA = sourceById[a.sourceId];
    const sourceB = sourceById[b.sourceId];
    const tierA = sourceA?.tier === "T1" ? 3 : sourceA?.tier === "T1.5" ? 2 : 1;
    const tierB = sourceB?.tier === "T1" ? 3 : sourceB?.tier === "T1.5" ? 2 : 1;
    return tierB - tierA || b.engagement - a.engagement || new Date(b.publishedAt) - new Date(a.publishedAt);
  })[0];
}

function whyItMatters(item, category, sourceCount, platformCount) {
  const sourceText = sourceCount >= 2 ? `已被 ${sourceCount} 个信源覆盖` : "目前仍是单源信号";
  const platformText = platformCount >= 2 ? `，跨 ${platformCount} 个平台出现` : "";
  const categoryText = {
    模型发布: "它可能改变模型能力边界、价格或开发者选型。",
    产品更新: "它直接影响开发者和团队可以使用的工具链。",
    开源生态: "它可能降低本地部署、二次开发或 Agent 工程门槛。",
    论文研究: "它提示新的研究方向和未来产品能力。",
    技巧与观点: "它反映社区正在形成的新实践或争议。",
    行业动态: "它会影响 AI 公司竞争格局、商业化和生态判断。"
  }[category] ?? "它可能影响 AI 产品、研发或行业判断。";
  return `${sourceText}${platformText}。${categoryText}`;
}

function inferTrend(items) {
  const newestHours = hoursSince(items[0]?.publishedAt);
  if (items.length >= 2 && newestHours <= 12) return "rising";
  if (newestHours <= 6) return "rising";
  if (newestHours <= 18) return "steady";
  if (items.length === 1) return "watch";
  return "cooling";
}

function recencyVelocity(items) {
  const newestHours = hoursSince(items[0]?.publishedAt);
  if (newestHours <= 6) return 0.58;
  if (newestHours <= 18) return 0.38;
  return 0.18;
}

function scoreImportance(category, sourceCount, platformCount) {
  const base = {
    模型发布: 82,
    产品更新: 76,
    开源生态: 74,
    行业动态: 72,
    论文研究: 70,
    技巧与观点: 64
  }[category] ?? 68;
  return clamp(base + Math.min(8, sourceCount * 2) + Math.min(6, platformCount * 2));
}

function scoreNovelty(publishedAt) {
  return clamp(96 - hoursSince(publishedAt) * 4, 38, 96);
}

function scoreActionability(category, item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const boost = /(api|github|release|open source|开源|发布|sdk|agent|model|模型)/i.test(text) ? 8 : 0;
  const base = {
    产品更新: 80,
    开源生态: 82,
    模型发布: 74,
    论文研究: 58,
    技巧与观点: 70,
    行业动态: 54
  }[category] ?? 62;
  return clamp(base + boost);
}

function scoreAudienceFit(item, category) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const keywordBoost = /(agent|llm|openai|claude|github|mcp|rag|模型|开源|开发者|api|推理|本地)/i.test(text) ? 9 : 0;
  const base = category === "技巧与观点" ? 72 : category === "行业动态" ? 66 : 76;
  return clamp(base + keywordBoost);
}

function dedupeRawItems(items) {
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    if (!item.title || !item.url) continue;
    const key = normalizeKey(item.url) || normalizeKey(item.title);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function acceptHeader(parser) {
  if (parser === "aihot" || parser === "hn" || parser === "github-releases") return "application/json,*/*";
  return "application/rss+xml,application/atom+xml,text/xml,*/*";
}

function extractBlocks(xml, tag) {
  const regex = new RegExp(`<${escapeRegExp(tag)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeRegExp(tag)}>`, "gi");
  return [...xml.matchAll(regex)].map((match) => match[1]);
}

function tagText(block, tag) {
  const match = block.match(new RegExp(`<${escapeRegExp(tag)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeRegExp(tag)}>`, "i"));
  return cleanText(match?.[1] || "");
}

function firstHref(block) {
  const alternate = block.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  if (alternate) return decodeXml(alternate[1]);
  const href = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  if (href) return decodeXml(href[1]);
  return tagText(block, "link");
}

function stripHtml(value) {
  return cleanText(String(value ?? "").replace(/<[^>]+>/g, " "));
}

function cleanText(value) {
  return stripHtmlPreserveText(decodeXml(String(value ?? "")))
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:，。！？；：])/g, "$1")
    .trim();
}

function stripHtmlPreserveText(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function decodeXml(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, num) => String.fromCodePoint(Number.parseInt(num, 10)));
}

function parseDate(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function hoursSince(value) {
  return Math.max(0, (Date.now() - new Date(value).getTime()) / 36e5);
}

function inferCategory(text, fallback) {
  const value = String(text ?? "").toLowerCase();
  if (/paper|arxiv|research|benchmark|论文|研究|评测/.test(value)) return "论文研究";
  if (/release|github|open source|repo|开源|版本|发布|sdk|mcp/.test(value)) return "开源生态";
  if (/model|llm|gpt|claude|gemini|mistral|模型|大模型|推理/.test(value)) return "模型发布";
  if (/product|api|agent|app|tool|产品|工具|应用|插件/.test(value)) return "产品更新";
  if (/funding|acquire|policy|regulation|融资|收购|监管|公司|估值/.test(value)) return "行业动态";
  return fallback || "行业动态";
}

function isAiRelevant(text) {
  return /\b(ai|artificial intelligence|llm|gpt|claude|gemini|openai|anthropic|deepseek|mistral|agent|agents|rag|transformer|inference|diffusion|neural|embedding|embeddings|vector|gpu|nvidia|cuda|machine learning|generative|ml|model|models|人工智能|大模型|模型|智能体|推理|生成式|开源模型)\b/i.test(
    String(text ?? "")
  );
}

function mapAihotCategory(category) {
  return (
    {
      "ai-models": "模型发布",
      "ai-products": "产品更新",
      industry: "行业动态",
      paper: "论文研究",
      tip: "技巧与观点"
    }[category] || "行业动态"
  );
}

function extractEntities(text) {
  const entities = new Set();
  const known = [
    "OpenAI",
    "Anthropic",
    "Google",
    "DeepMind",
    "Gemini",
    "Claude",
    "GPT",
    "Sora",
    "Mistral",
    "Hugging Face",
    "LangChain",
    "LlamaIndex",
    "Ollama",
    "vLLM",
    "MCP",
    "Replit",
    "StepFun",
    "DeepSeek",
    "GitHub",
    "Microsoft",
    "Meta",
    "NVIDIA",
    "arXiv",
    "RAG"
  ];
  for (const item of known) {
    if (new RegExp(`\\b${escapeRegExp(item)}\\b`, "i").test(text)) entities.add(item);
  }
  for (const match of String(text).matchAll(/\b[A-Z][A-Za-z0-9.-]{2,}(?:\s+[A-Z][A-Za-z0-9.-]{2,}){0,2}\b/g)) {
    const candidate = match[0].trim();
    if (!STOPWORDS.has(candidate.toLowerCase())) entities.add(candidate);
    if (entities.size >= 5) break;
  }
  return [...entities].slice(0, 5);
}

function normalizeKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function mostCommon(values) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function shortHash(value) {
  return createHash("sha1").update(String(value)).digest("hex").slice(0, 12);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "using",
  "about",
  "what",
  "your",
  "you",
  "are",
  "ai",
  "llm",
  "new",
  "live",
  "release",
  "update"
]);
