const tierWeight = {
  T1: 1.18,
  "T1.5": 1.08,
  T2: 0.92
};

const typeWeight = {
  official_blog: 1.16,
  official_social: 1.07,
  repo_release: 1.04,
  kol: 0.96,
  community: 0.9,
  media: 0.9,
  video: 0.88
};

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function hoursSince(dateLike, now = new Date("2026-05-24T13:00:00+08:00")) {
  return Math.max(0, (now.getTime() - new Date(dateLike).getTime()) / 36e5);
}

export function sourceAuthority(source) {
  return clamp((tierWeight[source.tier] ?? 0.9) * (typeWeight[source.type] ?? 0.9) * source.weight * 70);
}

export function buildSourceIndex(sources) {
  return Object.fromEntries(sources.map((source) => [source.id, source]));
}

export function computeEventScores(event, sourceIndex, rules) {
  const eventSources = event.sourceIds.map((id) => sourceIndex[id]).filter(Boolean);
  const platforms = new Set(eventSources.map((source) => source.platform));
  const primaryTier = bestTier(eventSources);
  const sourceAuthorityScore =
    eventSources.reduce((sum, source) => sum + sourceAuthority(source), 0) / Math.max(1, eventSources.length);
  const velocityScore = clamp((event.metrics.mentions6h / Math.max(1, event.metrics.mentions24h)) * 160);
  const crossPlatformScore = clamp(platforms.size * 22);
  const engagementScore = clamp(Math.log10(event.metrics.views + event.metrics.likes * 18 + 1) * 15);
  const recencyScore = clamp(100 - hoursSince(event.lastSeenAt) * 4);
  const hot =
    velocityScore * rules.hotScoreWeights.velocity +
    crossPlatformScore * rules.hotScoreWeights.crossPlatform +
    engagementScore * rules.hotScoreWeights.engagement +
    recencyScore * rules.hotScoreWeights.recency +
    sourceAuthorityScore * rules.hotScoreWeights.sourceAuthority;

  const quality =
    event.baseScores.importance * rules.selectionWeights.importance +
    event.baseScores.novelty * rules.selectionWeights.novelty +
    event.baseScores.actionability * rules.selectionWeights.actionability +
    event.baseScores.credibility * rules.selectionWeights.credibility +
    event.baseScores.audienceFit * rules.selectionWeights.audienceFit;

  const categoryBoost = rules.categoryBoosts[event.category] ?? 0;
  const trustBoost = primaryTier === "T1" ? 4 : primaryTier === "T1.5" ? 1.5 : -1;
  const selectedScore = clamp(quality + categoryBoost + trustBoost + (platforms.size >= 3 ? 2 : 0));
  const threshold = rules.thresholds[primaryTier] ?? 72;
  const confidence = clamp(sourceAuthorityScore * 0.62 + event.baseScores.credibility * 0.28 + platforms.size * 3);
  const scoreFactors = {
    velocity: {
      label: "传播速度",
      value: Math.round(velocityScore),
      weight: rules.hotScoreWeights.velocity
    },
    sourceCoverage: {
      label: "跨平台覆盖",
      value: Math.round(crossPlatformScore),
      weight: rules.hotScoreWeights.crossPlatform
    },
    engagement: {
      label: "互动讨论",
      value: Math.round(engagementScore),
      weight: rules.hotScoreWeights.engagement
    },
    freshness: {
      label: "新鲜度",
      value: Math.round(recencyScore),
      weight: rules.hotScoreWeights.recency
    },
    sourceAuthority: {
      label: "信源等级",
      value: Math.round(sourceAuthorityScore),
      weight: rules.hotScoreWeights.sourceAuthority
    }
  };
  const selectionFactors = {
    importance: {
      label: "重要性",
      value: event.baseScores.importance,
      weight: rules.selectionWeights.importance
    },
    novelty: {
      label: "新鲜程度",
      value: event.baseScores.novelty,
      weight: rules.selectionWeights.novelty
    },
    actionability: {
      label: "可操作性",
      value: event.baseScores.actionability,
      weight: rules.selectionWeights.actionability
    },
    credibility: {
      label: "可信度",
      value: event.baseScores.credibility,
      weight: rules.selectionWeights.credibility
    },
    audienceFit: {
      label: "受众匹配",
      value: event.baseScores.audienceFit,
      weight: rules.selectionWeights.audienceFit
    },
    ruleBoost: {
      label: "规则加权",
      value: Math.round(clamp(50 + categoryBoost * 5 + trustBoost * 5 + (platforms.size >= 3 ? 10 : 0))),
      weight: "rule"
    }
  };

  return {
    hotScore: Math.round(hot),
    selectedScore: Math.round(selectedScore),
    confidence: Math.round(confidence),
    selected: selectedScore >= threshold,
    threshold,
    primaryTier,
    platformCount: platforms.size,
    sourceAuthorityScore: Math.round(sourceAuthorityScore),
    scoreFactors,
    selectionFactors,
    tierCoverage: countTiers(eventSources),
    primarySource: choosePrimarySource(eventSources),
    scoreExplain: [
      `热度由传播速度 ${Math.round(velocityScore)}、跨平台 ${Math.round(crossPlatformScore)}、互动 ${Math.round(engagementScore)}、新鲜度 ${Math.round(recencyScore)}、信源权威 ${Math.round(sourceAuthorityScore)} 加权得到。`,
      `精选分由五维模型评分加规则权重得到，${primaryTier} 信源阈值为 ${threshold}。`,
      platforms.size >= 3 ? "已跨 3 个以上平台出现，降低单一信源噪音风险。" : "平台覆盖仍偏少，需要继续观察扩散质量。"
    ]
  };
}

function bestTier(sources) {
  if (sources.some((source) => source.tier === "T1")) return "T1";
  if (sources.some((source) => source.tier === "T1.5")) return "T1.5";
  return "T2";
}

function countTiers(sources) {
  return sources.reduce(
    (acc, source) => {
      acc[source.tier] = (acc[source.tier] ?? 0) + 1;
      return acc;
    },
    { T1: 0, "T1.5": 0, T2: 0 }
  );
}

function choosePrimarySource(sources) {
  return [...sources].sort((a, b) => sourceAuthority(b) - sourceAuthority(a))[0] ?? null;
}

export function enrichEvents(events, sources, rawItems, rules) {
  const sourceIndex = buildSourceIndex(sources);
  const rawIndex = Object.fromEntries(rawItems.map((item) => [item.id, item]));
  return events
    .map((event) => {
      const scores = computeEventScores(event, sourceIndex, rules);
      const relatedItems = event.relatedItemIds.map((id) => rawIndex[id]).filter(Boolean);
      const eventSources = event.sourceIds.map((id) => sourceIndex[id]).filter(Boolean);
      return {
        ...event,
        ...scores,
        relatedItems,
        sources: eventSources,
        platforms: [...new Set(eventSources.map((source) => source.platform))]
      };
    })
    .sort((a, b) => b.hotScore - a.hotScore);
}

export function clusterSignature(item) {
  return normalize(`${item.title} ${item.platform}`)
    .split(" ")
    .filter((token) => token.length > 2)
    .slice(0, 8)
    .join("-");
}

export function simulateCluster(rawItems) {
  const clusters = new Map();
  rawItems.forEach((item) => {
    const key = item.eventId || clusterSignature(item);
    const current = clusters.get(key) ?? [];
    current.push(item);
    clusters.set(key, current);
  });
  return [...clusters.entries()].map(([clusterId, items]) => ({
    clusterId,
    itemCount: items.length,
    platforms: [...new Set(items.map((item) => item.platform))],
    primaryItem: choosePrimaryItem(items),
    items
  }));
}

function choosePrimaryItem(items) {
  const priority = {
    Official: 4,
    GitHub: 3,
    X: 2,
    RSS: 1,
    HN: 1,
    YouTube: 1
  };
  return [...items].sort((a, b) => (priority[b.platform] ?? 0) - (priority[a.platform] ?? 0) || b.engagement - a.engagement)[0];
}

function normalize(value) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function buildDailyBrief(enrichedEvents) {
  const sections = ["模型发布", "产品更新", "行业动态", "开源生态"].map((category) => ({
    category,
    events: enrichedEvents
      .filter((event) => event.category === category && event.selected)
      .sort((a, b) => b.selectedScore - a.selectedScore)
      .slice(0, 4)
  }));

  return {
    title: "AI/科技 24 小时情报日报",
    generatedAt: "2026-05-24T08:00:00+08:00",
    sections,
    risingEvents: enrichedEvents.filter((event) => event.trend === "rising").slice(0, 4),
    coolingEvents: enrichedEvents.filter((event) => event.trend === "cooling").slice(0, 4),
    watchList: enrichedEvents.filter((event) => event.status === "watch" || event.trend === "volatile").slice(0, 3)
  };
}

export function buildSnapshot({ events, sources, rawItems, rules, jobs }) {
  const enrichedEvents = enrichEvents(events, sources, rawItems, rules);
  const clusters = simulateCluster(rawItems);
  const selectedEvents = enrichedEvents.filter((event) => event.selected);
  const risingEvents = enrichedEvents.filter((event) => event.trend === "rising");
  const highTrustEvents = enrichedEvents.filter((event) => event.primaryTier === "T1" || event.confidence >= 74);
  const sourceMix = Object.entries(
    sources.reduce((acc, source) => {
      acc[source.platform] = (acc[source.platform] ?? 0) + source.items24h;
      return acc;
    }, {})
  ).map(([platform, count]) => ({ platform, count }));

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      rawItems: rawItems.length,
      clusters: clusters.length,
      events: enrichedEvents.length,
      selected: selectedEvents.length,
      rising: risingEvents.length,
      highTrust: highTrustEvents.length
    },
    events: enrichedEvents,
    sources,
    rawItems,
    clusters,
    rules,
    jobs,
    dailyBrief: buildDailyBrief(enrichedEvents),
    sourceMix
  };
}
