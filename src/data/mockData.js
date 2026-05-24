export const sources = [
  {
    id: "src-openai-blog",
    name: "OpenAI Blog",
    platform: "Official",
    tier: "T1",
    type: "official_blog",
    owner: "OpenAI",
    enabled: true,
    weight: 1.25,
    latencyMin: 8,
    items24h: 3
  },
  {
    id: "src-anthropic-news",
    name: "Anthropic Newsroom",
    platform: "Official",
    tier: "T1",
    type: "official_blog",
    owner: "Anthropic",
    enabled: true,
    weight: 1.22,
    latencyMin: 10,
    items24h: 2
  },
  {
    id: "src-deepmind-blog",
    name: "Google DeepMind Blog",
    platform: "Official",
    tier: "T1",
    type: "official_blog",
    owner: "Google DeepMind",
    enabled: true,
    weight: 1.2,
    latencyMin: 14,
    items24h: 2
  },
  {
    id: "src-openai-x",
    name: "OpenAI Developers",
    platform: "X",
    tier: "T1.5",
    type: "official_social",
    owner: "OpenAI",
    enabled: true,
    weight: 1.1,
    latencyMin: 5,
    items24h: 8
  },
  {
    id: "src-stepfun-x",
    name: "StepFun",
    platform: "X",
    tier: "T1.5",
    type: "official_social",
    owner: "StepFun",
    enabled: true,
    weight: 1.04,
    latencyMin: 6,
    items24h: 4
  },
  {
    id: "src-rohan-x",
    name: "Rohan Paul",
    platform: "X",
    tier: "T2",
    type: "kol",
    owner: "Independent",
    enabled: true,
    weight: 0.96,
    latencyMin: 4,
    items24h: 13
  },
  {
    id: "src-dotey-x",
    name: "宝玉 dotey",
    platform: "X",
    tier: "T2",
    type: "kol",
    owner: "Independent",
    enabled: true,
    weight: 0.98,
    latencyMin: 3,
    items24h: 7
  },
  {
    id: "src-hn",
    name: "Hacker News Hot",
    platform: "HN",
    tier: "T2",
    type: "community",
    owner: "Hacker News",
    enabled: true,
    weight: 0.92,
    latencyMin: 18,
    items24h: 19
  },
  {
    id: "src-ithome",
    name: "IT之家 RSS",
    platform: "RSS",
    tier: "T2",
    type: "media",
    owner: "IT之家",
    enabled: true,
    weight: 0.88,
    latencyMin: 22,
    items24h: 31
  },
  {
    id: "src-decoder",
    name: "The Decoder AI",
    platform: "RSS",
    tier: "T2",
    type: "media",
    owner: "The Decoder",
    enabled: true,
    weight: 0.9,
    latencyMin: 26,
    items24h: 11
  },
  {
    id: "src-youtube",
    name: "AI YouTube Radar",
    platform: "YouTube",
    tier: "T2",
    type: "video",
    owner: "Curated Channels",
    enabled: true,
    weight: 0.86,
    latencyMin: 35,
    items24h: 9
  },
  {
    id: "src-github",
    name: "GitHub Release Watch",
    platform: "GitHub",
    tier: "T1.5",
    type: "repo_release",
    owner: "GitHub",
    enabled: true,
    weight: 1.03,
    latencyMin: 15,
    items24h: 10
  }
];

export const events = [
  {
    id: "evt-replit-qa-loop",
    title: "Replit Agent 接入 Squidler，形成构建-测试-修复闭环",
    category: "产品更新",
    entities: ["Replit", "Squidler", "MCP"],
    summary:
      "Replit Agent 与 Squidler 完成集成，用户用自然语言构建应用后，Squidler 可以像真实用户一样执行测试，并把问题反馈给 Agent 修复。",
    whyItMatters:
      "这不是单点工具发布，而是 AI 编程从生成代码向自动质量保障闭环推进。对独立开发者和轻量团队尤其有价值。",
    firstSeenAt: "2026-05-23T19:00:06+08:00",
    lastSeenAt: "2026-05-24T12:22:00+08:00",
    status: "published",
    trend: "rising",
    baseScores: {
      importance: 82,
      novelty: 76,
      actionability: 88,
      credibility: 72,
      audienceFit: 84
    },
    sourceIds: ["src-openai-x", "src-rohan-x", "src-hn", "src-youtube"],
    relatedItemIds: ["raw-replit-1", "raw-replit-2", "raw-replit-3", "raw-replit-4"],
    metrics: {
      mentions24h: 31,
      mentions6h: 11,
      views: 420000,
      comments: 164,
      reposts: 840,
      likes: 6100
    }
  },
  {
    id: "evt-stepaudio-25",
    title: "StepAudio 2.5 Realtime 发布，强调副语言感知与人格化语音交互",
    category: "模型发布",
    entities: ["StepFun", "StepAudio", "Realtime Voice"],
    summary:
      "阶跃星辰发布 StepAudio 2.5 Realtime，强调对语气、语速、停顿等副语言特征的理解，并支持通过 API 定制人格。",
    whyItMatters:
      "实时语音模型开始从听清内容转向识别情绪和互动人格，适合虚拟人、客服、陪伴和教育场景。",
    firstSeenAt: "2026-05-23T21:45:21+08:00",
    lastSeenAt: "2026-05-24T11:10:00+08:00",
    status: "published",
    trend: "rising",
    baseScores: {
      importance: 78,
      novelty: 81,
      actionability: 73,
      credibility: 76,
      audienceFit: 78
    },
    sourceIds: ["src-stepfun-x", "src-ithome", "src-youtube"],
    relatedItemIds: ["raw-step-1", "raw-step-2", "raw-step-3"],
    metrics: {
      mentions24h: 22,
      mentions6h: 8,
      views: 260000,
      comments: 91,
      reposts: 510,
      likes: 3900
    }
  },
  {
    id: "evt-anthropic-finance",
    title: "Anthropic 新融资传闻升温，估值和营收数据引发讨论",
    category: "行业动态",
    entities: ["Anthropic", "OpenAI", "融资"],
    summary:
      "多家媒体讨论 Anthropic 可能完成大额融资，市场关注其营收增速、估值变化以及与 OpenAI 的竞争格局。",
    whyItMatters:
      "融资传闻本身需要谨慎，但资本市场对头部模型公司的估值变化会影响企业采购、人才流动和生态信心。",
    firstSeenAt: "2026-05-23T15:12:40+08:00",
    lastSeenAt: "2026-05-24T09:40:00+08:00",
    status: "watch",
    trend: "volatile",
    baseScores: {
      importance: 84,
      novelty: 66,
      actionability: 46,
      credibility: 58,
      audienceFit: 70
    },
    sourceIds: ["src-ithome", "src-decoder", "src-rohan-x"],
    relatedItemIds: ["raw-anthropic-1", "raw-anthropic-2", "raw-anthropic-3"],
    metrics: {
      mentions24h: 36,
      mentions6h: 5,
      views: 610000,
      comments: 280,
      reposts: 730,
      likes: 5200
    }
  },
  {
    id: "evt-mistral-emmi",
    title: "Mistral 收购 Emmi AI，押注工业 AI 与物理仿真",
    category: "行业动态",
    entities: ["Mistral", "Emmi AI", "工业 AI"],
    summary:
      "Mistral 宣布收购物理 AI 公司 Emmi AI，计划强化实时仿真、数字孪生和工业工程场景能力。",
    whyItMatters:
      "基础模型公司正向垂直场景整合能力，工业 AI 可能成为模型落地的重要商业路径。",
    firstSeenAt: "2026-05-23T17:46:00+08:00",
    lastSeenAt: "2026-05-24T10:32:00+08:00",
    status: "published",
    trend: "steady",
    baseScores: {
      importance: 79,
      novelty: 72,
      actionability: 58,
      credibility: 83,
      audienceFit: 69
    },
    sourceIds: ["src-decoder", "src-hn", "src-rohan-x"],
    relatedItemIds: ["raw-mistral-1", "raw-mistral-2", "raw-mistral-3"],
    metrics: {
      mentions24h: 18,
      mentions6h: 4,
      views: 180000,
      comments: 70,
      reposts: 260,
      likes: 2100
    }
  },
  {
    id: "evt-models-dev",
    title: "Models.dev 开源模型规格数据库在开发者社区升温",
    category: "开源生态",
    entities: ["models.dev", "GitHub", "HN"],
    summary:
      "Models.dev 以开源方式整理不同 AI 模型的规格、价格和功能信息，在 Hacker News 和 GitHub 开发者圈获得关注。",
    whyItMatters:
      "模型选型正在从经验判断转向结构化比较，这类基础数据库会成为 Agent、IDE 和企业采购工具的底层资料。",
    firstSeenAt: "2026-05-23T09:57:00+08:00",
    lastSeenAt: "2026-05-24T06:20:00+08:00",
    status: "published",
    trend: "steady",
    baseScores: {
      importance: 70,
      novelty: 68,
      actionability: 86,
      credibility: 73,
      audienceFit: 82
    },
    sourceIds: ["src-hn", "src-github", "src-dotey-x"],
    relatedItemIds: ["raw-models-1", "raw-models-2", "raw-models-3"],
    metrics: {
      mentions24h: 14,
      mentions6h: 2,
      views: 115000,
      comments: 101,
      reposts: 180,
      likes: 1600
    }
  },
  {
    id: "evt-bitcpm-cann",
    title: "BitCPM-CANN 发布：1.58-bit 开源大模型原生跑通昇腾训练栈",
    category: "模型发布",
    entities: ["BitCPM", "OpenBMB", "华为昇腾"],
    summary:
      "ModelBest、清华和 OpenBMB 发布 BitCPM-CANN，主打 1.58-bit 三元权重量化，并在华为昇腾 910B 上原生训练验证。",
    whyItMatters:
      "端侧和国产算力生态同时受益。它更像基础设施信号，而不是单纯模型榜单更新。",
    firstSeenAt: "2026-05-22T22:56:00+08:00",
    lastSeenAt: "2026-05-24T03:48:00+08:00",
    status: "published",
    trend: "cooling",
    baseScores: {
      importance: 80,
      novelty: 86,
      actionability: 69,
      credibility: 76,
      audienceFit: 74
    },
    sourceIds: ["src-rohan-x", "src-github", "src-hn"],
    relatedItemIds: ["raw-bitcpm-1", "raw-bitcpm-2", "raw-bitcpm-3"],
    metrics: {
      mentions24h: 25,
      mentions6h: 3,
      views: 320000,
      comments: 144,
      reposts: 610,
      likes: 4400
    }
  },
  {
    id: "evt-genie-street-view",
    title: "Google Genie 接入 Street View，生成可交互世界的产品信号增强",
    category: "产品更新",
    entities: ["Google DeepMind", "Genie", "Street View"],
    summary:
      "Google DeepMind 展示 Project Genie 与 Google Maps Street View 的结合，把真实地点转化为可交互世界。",
    whyItMatters:
      "生成式游戏和空间内容不再只停留在 demo，真实世界数据输入可能成为新一代交互内容生产入口。",
    firstSeenAt: "2026-05-22T23:14:00+08:00",
    lastSeenAt: "2026-05-24T02:05:00+08:00",
    status: "published",
    trend: "cooling",
    baseScores: {
      importance: 74,
      novelty: 88,
      actionability: 48,
      credibility: 80,
      audienceFit: 76
    },
    sourceIds: ["src-deepmind-blog", "src-youtube", "src-rohan-x"],
    relatedItemIds: ["raw-genie-1", "raw-genie-2", "raw-genie-3"],
    metrics: {
      mentions24h: 19,
      mentions6h: 2,
      views: 510000,
      comments: 230,
      reposts: 950,
      likes: 7300
    }
  },
  {
    id: "evt-deepseek-pricing",
    title: "DeepSeek V4-Pro 折扣长期化，API 成本战继续",
    category: "行业动态",
    entities: ["DeepSeek", "API 价格", "模型成本"],
    summary:
      "DeepSeek 宣布 V4-Pro 折扣长期化，引发开发者对模型成本、价格战和供应商锁定的讨论。",
    whyItMatters:
      "价格调整会直接改变应用开发者的模型路由和产品毛利，成本信号比参数发布更能影响落地。",
    firstSeenAt: "2026-05-22T00:20:00+08:00",
    lastSeenAt: "2026-05-23T23:10:00+08:00",
    status: "published",
    trend: "steady",
    baseScores: {
      importance: 72,
      novelty: 61,
      actionability: 84,
      credibility: 78,
      audienceFit: 81
    },
    sourceIds: ["src-ithome", "src-rohan-x", "src-youtube"],
    relatedItemIds: ["raw-deepseek-1", "raw-deepseek-2", "raw-deepseek-3"],
    metrics: {
      mentions24h: 17,
      mentions6h: 4,
      views: 240000,
      comments: 130,
      reposts: 330,
      likes: 2600
    }
  }
];

export const rawItems = [
  {
    id: "raw-replit-1",
    eventId: "evt-replit-qa-loop",
    sourceId: "src-openai-x",
    platform: "X",
    title: "Replit Agent builds your app. Squidler tests it like a real user.",
    url: "https://x.com/Replit/status/2058261705998602548",
    publishedAt: "2026-05-23T19:00:06+08:00",
    engagement: 8200
  },
  {
    id: "raw-replit-2",
    eventId: "evt-replit-qa-loop",
    sourceId: "src-rohan-x",
    platform: "X",
    title: "AI QA loop: Replit Agent plus Squidler MCP integration",
    url: "https://x.com/rohanpaul_ai",
    publishedAt: "2026-05-23T20:32:00+08:00",
    engagement: 3800
  },
  {
    id: "raw-replit-3",
    eventId: "evt-replit-qa-loop",
    sourceId: "src-hn",
    platform: "HN",
    title: "Show HN: Squidler tests Replit apps as a user",
    url: "https://news.ycombinator.com/",
    publishedAt: "2026-05-24T08:10:00+08:00",
    engagement: 980
  },
  {
    id: "raw-replit-4",
    eventId: "evt-replit-qa-loop",
    sourceId: "src-youtube",
    platform: "YouTube",
    title: "Watching an AI agent build and test a full web app",
    url: "https://youtube.com/",
    publishedAt: "2026-05-24T12:22:00+08:00",
    engagement: 1800
  },
  {
    id: "raw-step-1",
    eventId: "evt-stepaudio-25",
    sourceId: "src-stepfun-x",
    platform: "X",
    title: "StepAudio 2.5 Realtime is live",
    url: "https://x.com/StepFun_ai",
    publishedAt: "2026-05-23T21:45:21+08:00",
    engagement: 4100
  },
  {
    id: "raw-step-2",
    eventId: "evt-stepaudio-25",
    sourceId: "src-ithome",
    platform: "RSS",
    title: "阶跃星辰发布 StepAudio 2.5 实时语音模型",
    url: "https://www.ithome.com/",
    publishedAt: "2026-05-24T05:49:00+08:00",
    engagement: 1400
  },
  {
    id: "raw-step-3",
    eventId: "evt-stepaudio-25",
    sourceId: "src-youtube",
    platform: "YouTube",
    title: "Realtime voice model understands tone and pause",
    url: "https://youtube.com/",
    publishedAt: "2026-05-24T11:10:00+08:00",
    engagement: 900
  },
  {
    id: "raw-anthropic-1",
    eventId: "evt-anthropic-finance",
    sourceId: "src-ithome",
    platform: "RSS",
    title: "Anthropic 融资传闻与估值讨论",
    url: "https://www.ithome.com/0/954/452.htm",
    publishedAt: "2026-05-23T15:12:40+08:00",
    engagement: 3000
  },
  {
    id: "raw-anthropic-2",
    eventId: "evt-anthropic-finance",
    sourceId: "src-decoder",
    platform: "RSS",
    title: "Anthropic funding talks raise valuation questions",
    url: "https://the-decoder.com/",
    publishedAt: "2026-05-23T18:42:00+08:00",
    engagement: 1800
  },
  {
    id: "raw-anthropic-3",
    eventId: "evt-anthropic-finance",
    sourceId: "src-rohan-x",
    platform: "X",
    title: "Market reaction to Anthropic financing rumors",
    url: "https://x.com/rohanpaul_ai",
    publishedAt: "2026-05-24T09:40:00+08:00",
    engagement: 2600
  },
  {
    id: "raw-mistral-1",
    eventId: "evt-mistral-emmi",
    sourceId: "src-decoder",
    platform: "RSS",
    title: "Mistral doubles down on science to win industrial AI",
    url: "https://mistral.ai/news/science-to-win-industrial-ai",
    publishedAt: "2026-05-23T17:46:00+08:00",
    engagement: 1700
  },
  {
    id: "raw-mistral-2",
    eventId: "evt-mistral-emmi",
    sourceId: "src-hn",
    platform: "HN",
    title: "Mistral acquires Emmi AI",
    url: "https://news.ycombinator.com/",
    publishedAt: "2026-05-23T23:04:00+08:00",
    engagement: 820
  },
  {
    id: "raw-mistral-3",
    eventId: "evt-mistral-emmi",
    sourceId: "src-rohan-x",
    platform: "X",
    title: "Industrial AI is becoming the next model-company wedge",
    url: "https://x.com/rohanpaul_ai",
    publishedAt: "2026-05-24T10:32:00+08:00",
    engagement: 900
  },
  {
    id: "raw-models-1",
    eventId: "evt-models-dev",
    sourceId: "src-hn",
    platform: "HN",
    title: "Models.dev: open database for model specs and pricing",
    url: "https://news.ycombinator.com/",
    publishedAt: "2026-05-23T09:57:00+08:00",
    engagement: 2100
  },
  {
    id: "raw-models-2",
    eventId: "evt-models-dev",
    sourceId: "src-github",
    platform: "GitHub",
    title: "anomalyco/models.dev",
    url: "https://github.com/anomalyco/models.dev",
    publishedAt: "2026-05-23T10:10:00+08:00",
    engagement: 3000
  },
  {
    id: "raw-models-3",
    eventId: "evt-models-dev",
    sourceId: "src-dotey-x",
    platform: "X",
    title: "模型选型数据库值得放进工具链",
    url: "https://x.com/dotey",
    publishedAt: "2026-05-24T06:20:00+08:00",
    engagement: 1100
  },
  {
    id: "raw-bitcpm-1",
    eventId: "evt-bitcpm-cann",
    sourceId: "src-rohan-x",
    platform: "X",
    title: "First 1.58-bit open LLM trained on Ascend 910B stack",
    url: "https://x.com/rohanpaul_ai",
    publishedAt: "2026-05-22T22:56:00+08:00",
    engagement: 5200
  },
  {
    id: "raw-bitcpm-2",
    eventId: "evt-bitcpm-cann",
    sourceId: "src-github",
    platform: "GitHub",
    title: "OpenBMB BitCPM-CANN release",
    url: "https://github.com/OpenBMB",
    publishedAt: "2026-05-23T07:30:00+08:00",
    engagement: 2300
  },
  {
    id: "raw-bitcpm-3",
    eventId: "evt-bitcpm-cann",
    sourceId: "src-hn",
    platform: "HN",
    title: "BitCPM-CANN on Ascend hardware",
    url: "https://news.ycombinator.com/",
    publishedAt: "2026-05-24T03:48:00+08:00",
    engagement: 900
  },
  {
    id: "raw-genie-1",
    eventId: "evt-genie-street-view",
    sourceId: "src-deepmind-blog",
    platform: "Official",
    title: "Project Genie meets Google Maps Street View",
    url: "https://deepmind.google/",
    publishedAt: "2026-05-22T23:14:00+08:00",
    engagement: 6200
  },
  {
    id: "raw-genie-2",
    eventId: "evt-genie-street-view",
    sourceId: "src-youtube",
    platform: "YouTube",
    title: "Turning real locations into playable worlds",
    url: "https://youtube.com/",
    publishedAt: "2026-05-23T14:10:00+08:00",
    engagement: 4800
  },
  {
    id: "raw-genie-3",
    eventId: "evt-genie-street-view",
    sourceId: "src-rohan-x",
    platform: "X",
    title: "Genie and Street View signal a new UI for game creation",
    url: "https://x.com/rohanpaul_ai",
    publishedAt: "2026-05-24T02:05:00+08:00",
    engagement: 2300
  },
  {
    id: "raw-deepseek-1",
    eventId: "evt-deepseek-pricing",
    sourceId: "src-ithome",
    platform: "RSS",
    title: "DeepSeek V4-Pro 折扣长期化",
    url: "https://www.ithome.com/",
    publishedAt: "2026-05-22T00:20:00+08:00",
    engagement: 1500
  },
  {
    id: "raw-deepseek-2",
    eventId: "evt-deepseek-pricing",
    sourceId: "src-rohan-x",
    platform: "X",
    title: "API pricing pressure continues",
    url: "https://x.com/rohanpaul_ai",
    publishedAt: "2026-05-23T11:20:00+08:00",
    engagement: 1000
  },
  {
    id: "raw-deepseek-3",
    eventId: "evt-deepseek-pricing",
    sourceId: "src-youtube",
    platform: "YouTube",
    title: "What cheaper model APIs mean for builders",
    url: "https://youtube.com/",
    publishedAt: "2026-05-23T23:10:00+08:00",
    engagement: 1600
  }
];

export const rules = {
  hotScoreWeights: {
    velocity: 0.28,
    crossPlatform: 0.18,
    engagement: 0.18,
    recency: 0.16,
    sourceAuthority: 0.2
  },
  selectionWeights: {
    importance: 0.27,
    novelty: 0.2,
    actionability: 0.19,
    credibility: 0.19,
    audienceFit: 0.15
  },
  thresholds: {
    T1: 60,
    "T1.5": 66,
    T2: 72
  },
  categoryBoosts: {
    "模型发布": 3,
    "产品更新": 2,
    "开源生态": 2,
    "行业动态": 0
  }
};

export const jobs = [
  {
    id: "job-ingest",
    name: "模拟抓取",
    status: "ok",
    lastRunAt: "2026-05-24T12:18:00+08:00",
    durationMs: 1240,
    result: "24 条 raw item 入库"
  },
  {
    id: "job-cluster",
    name: "事件聚类",
    status: "ok",
    lastRunAt: "2026-05-24T12:19:00+08:00",
    durationMs: 610,
    result: "24 条信号聚成 8 个事件"
  },
  {
    id: "job-score",
    name: "重新计分",
    status: "ok",
    lastRunAt: "2026-05-24T12:20:00+08:00",
    durationMs: 430,
    result: "8 个事件完成热度和精选分"
  },
  {
    id: "job-brief",
    name: "生成日报",
    status: "warning",
    lastRunAt: "2026-05-24T08:00:00+08:00",
    durationMs: 980,
    result: "1 个融资传闻标记为待核实"
  }
];
