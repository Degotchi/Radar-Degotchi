import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  Database,
  FileText,
  Flame,
  Layers3,
  LockKeyhole,
  MessageSquareText,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { events as mockEvents, jobs as mockJobs, rawItems as mockRawItems, rules as mockRules, sources as mockSources } from "./data/mockData.js";
import { buildSnapshot } from "./lib/scoring.js";

const fallbackSnapshot = buildSnapshot({
  events: mockEvents,
  sources: mockSources,
  rawItems: mockRawItems,
  rules: mockRules,
  jobs: mockJobs
});

const categoryTone = {
  "模型发布": "blue",
  "产品更新": "green",
  "行业动态": "orange",
  "开源生态": "violet"
};

export default function App() {
  const [snapshot, setSnapshot] = useState(fallbackSnapshot);
  const [activeView, setActiveView] = useState("home");
  const [query, setQuery] = useState("");
  const [briefFilter, setBriefFilter] = useState("全部");
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [llmState, setLlmState] = useState({ loading: false, eventId: null, text: "" });

  useEffect(() => {
    fetch("/api/snapshot")
      .then((response) => response.json())
      .then((data) => setSnapshot(data))
      .catch(() => setSnapshot(fallbackSnapshot))
      .finally(() => setLoading(false));
  }, []);

  const selectedEvent = useMemo(() => {
    return snapshot.events.find((event) => event.id === selectedEventId) ?? null;
  }, [selectedEventId, snapshot.events]);

  const filteredEvents = useMemo(() => {
    return snapshot.events.filter((event) => {
      const keyword = `${event.title} ${event.summary} ${event.whyItMatters} ${event.entities.join(" ")}`.toLowerCase();
      const matchesQuery = !query || keyword.includes(query.toLowerCase());
      const matchesFilter =
        briefFilter === "全部" ||
        event.category === briefFilter ||
        (briefFilter === "正在升温" && event.trend === "rising") ||
        (briefFilter === "持续观察" && (event.status === "watch" || event.trend === "volatile"));
      return matchesQuery && matchesFilter;
    });
  }, [snapshot.events, query, briefFilter]);

  async function runRecompute() {
    setToast("正在重新整理本地模拟事件...");
    try {
      const response = await fetch("/api/jobs/recompute", { method: "POST" });
      const data = await response.json();
      if (data.snapshot) setSnapshot(data.snapshot);
      setToast("已重新生成首页简报和事件排序");
    } catch {
      setToast("本地 API 暂不可用，首页继续使用内置模拟数据");
    }
    window.setTimeout(() => setToast(""), 2400);
  }

  async function explainWithLlm(eventId) {
    setSelectedEventId(eventId);
    setLlmState({ loading: true, eventId, text: "" });
    try {
      const response = await fetch("/api/llm/event-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId })
      });
      const data = await response.json();
      setLlmState({ loading: false, eventId, text: cleanLlmText(data.text) || "没有返回分析。" });
    } catch {
      setLlmState({
        loading: false,
        eventId,
        text: "LLM 暂不可用。你仍然可以查看事件摘要、为什么重要、信源证据和时间线。"
      });
    }
  }

  return (
    <div className="product-shell">
      <AppHeader
        activeView={activeView}
        setActiveView={setActiveView}
        query={query}
        setQuery={setQuery}
        loading={loading}
      />
      {toast && <div className="toast">{toast}</div>}

      {activeView === "home" && (
        <HomePage
          snapshot={snapshot}
          events={filteredEvents}
          query={query}
          setQuery={setQuery}
          briefFilter={briefFilter}
          setBriefFilter={setBriefFilter}
          onOpenEvent={setSelectedEventId}
          onExplain={explainWithLlm}
          onRecompute={runRecompute}
        />
      )}

      {activeView === "brief" && (
        <BriefPage brief={snapshot.dailyBrief} events={snapshot.events} onOpenEvent={setSelectedEventId} />
      )}

      {activeView === "sources" && <SourcesPage sources={snapshot.sources} sourceMix={snapshot.sourceMix} />}

      {activeView === "admin" && (
        <AdminPage snapshot={snapshot} onRecompute={runRecompute} onOpenEvent={setSelectedEventId} />
      )}

      <EventDrawer event={selectedEvent} onClose={() => setSelectedEventId(null)} onExplain={explainWithLlm} llmState={llmState} />
    </div>
  );
}

function AppHeader({ activeView, setActiveView, query, setQuery, loading }) {
  const navItems = [
    { id: "home", label: "首页" },
    { id: "brief", label: "今日简报" },
    { id: "sources", label: "信源说明" }
  ];

  return (
    <header className="app-header">
      <button className="brand-button" onClick={() => setActiveView("home")}>
        <span className="brand-logo">AI</span>
        <span>
          <strong>AI Hot Radar</strong>
          <small>{loading ? "正在连接本地数据" : "24 小时热点简报"}</small>
        </span>
      </button>

      <div className="header-search">
        <Search size={16} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索事件、公司、模型、关键词" />
      </div>

      <nav className="header-nav">
        {navItems.map((item) => (
          <button key={item.id} className={activeView === item.id ? "active" : ""} onClick={() => setActiveView(item.id)}>
            {item.label}
          </button>
        ))}
        <AdminLink active={activeView === "admin"} onClick={() => setActiveView("admin")} />
      </nav>
    </header>
  );
}

function AdminLink({ active, onClick }) {
  return (
    <button className={`admin-link ${active ? "active" : ""}`} onClick={onClick}>
      <Settings2 size={14} />
      管理
    </button>
  );
}

function HomePage({
  snapshot,
  events,
  query,
  setQuery,
  briefFilter,
  setBriefFilter,
  onOpenEvent,
  onExplain,
  onRecompute
}) {
  const topEvent = events[0] ?? snapshot.events[0];
  const importantEvents = snapshot.events.filter((event) => event.selected).slice(0, 3);
  const categories = ["全部", "正在升温", "持续观察", ...new Set(snapshot.events.map((event) => event.category))];

  return (
    <main className="home-page">
      <HeroBrief snapshot={snapshot} topEvent={topEvent} importantEvents={importantEvents} onRecompute={onRecompute} />

      <section className="home-layout">
        <div className="content-column">
          <TrustStrip snapshot={snapshot} />

          <TopEventCard event={topEvent} onOpenEvent={onOpenEvent} onExplain={onExplain} />

          <section className="event-section">
            <SectionTitle
              eyebrow="Hot Events"
              title="今天值得看的 AI/科技热点"
              caption="每条都是聚合后的事件，不是单条资讯标题。"
            />
            <div className="filter-pills">
              {categories.map((category) => (
                <button key={category} className={briefFilter === category ? "active" : ""} onClick={() => setBriefFilter(category)}>
                  {category}
                </button>
              ))}
            </div>
            <EventFeed events={events} onOpenEvent={onOpenEvent} onExplain={onExplain} />
          </section>
        </div>

        <aside className="side-column">
          <BriefEntry brief={snapshot.dailyBrief} onOpenEvent={onOpenEvent} />
          <TrendSection events={snapshot.events} />
          <SearchSuggestion query={query} setQuery={setQuery} />
        </aside>
      </section>
    </main>
  );
}

function HeroBrief({ snapshot, topEvent, importantEvents, onRecompute }) {
  const latestUpdate = topEvent ? formatTime(topEvent.lastSeenAt) : "刚刚";
  return (
    <section className="hero-brief">
      <div className="hero-copy">
        <p className="eyebrow">AI / 科技热点 24 小时</p>
        <h1>用 3 分钟看懂过去 24 小时真正重要的事</h1>
        <p className="hero-lead">
          自动把多平台信号聚合成事件，先告诉你发生了什么，再解释为什么值得关注。
        </p>
        <div className="hero-actions">
          <a href="#events" className="primary-action">
            开始阅读
            <ArrowUpRight size={16} />
          </a>
          <button className="secondary-action" onClick={onRecompute}>
            <Activity size={16} />
            重新整理
          </button>
        </div>
      </div>

      <div className="hero-panel">
        <div className="today-status">
          <span>今日态势</span>
          <strong>{snapshot.metrics.rising} 个事件正在升温</strong>
          <small>最近更新 {latestUpdate}</small>
        </div>
        <div className="today-three">
          <p>今日 3 件大事</p>
          {importantEvents.map((event, index) => (
            <article key={event.id}>
              <span>{index + 1}</span>
              <strong>{event.title}</strong>
            </article>
          ))}
        </div>
        <div className="hero-metrics">
          <Metric label="原始信号" value={snapshot.metrics.rawItems} />
          <Metric label="聚合事件" value={snapshot.metrics.events} />
          <Metric label="精选入选" value={snapshot.metrics.selected} />
        </div>
      </div>
    </section>
  );
}

function TopEventCard({ event, onOpenEvent, onExplain }) {
  if (!event) return null;
  return (
    <section className="top-event-card" id="events">
      <div className="top-event-meta">
        <Tag tone={categoryTone[event.category]}>{event.category}</Tag>
        <TrustBadge event={event} />
        <span>{trendText(event.trend)}</span>
      </div>
      <h2>{event.title}</h2>
      <p>{event.summary}</p>
      <div className="why-box">
        <strong>为什么重要</strong>
        <span>{event.whyItMatters}</span>
      </div>
      <EvidenceLine event={event} />
      <div className="card-actions">
        <button onClick={() => onOpenEvent(event.id)}>查看证据</button>
        <button className="ghost" onClick={() => onExplain(event.id)}>
          <Bot size={16} />
          AI 分析
        </button>
      </div>
    </section>
  );
}

function EventFeed({ events, onOpenEvent, onExplain }) {
  if (!events.length) {
    return <div className="empty-state">没有匹配到事件，换个关键词试试。</div>;
  }
  return (
    <div className="event-feed">
      {events.map((event) => (
        <EventCard key={event.id} event={event} onOpenEvent={onOpenEvent} onExplain={onExplain} />
      ))}
    </div>
  );
}

function EventCard({ event, onOpenEvent, onExplain }) {
  return (
    <article className="event-card">
      <div className="event-card-head">
        <Tag tone={categoryTone[event.category]}>{event.category}</Tag>
        <TrustBadge event={event} />
        <span className="update-text">{formatTime(event.lastSeenAt)}</span>
      </div>
      <button className="event-title-button" onClick={() => onOpenEvent(event.id)}>
        {event.title}
      </button>
      <p>{event.summary}</p>
      <div className="event-why">
        <MessageSquareText size={15} />
        <span>{event.whyItMatters}</span>
      </div>
      <EvidenceLine event={event} compact />
      <div className="event-card-actions">
        <button onClick={() => onOpenEvent(event.id)}>展开详情</button>
        <button onClick={() => onExplain(event.id)}>AI 分析</button>
      </div>
    </article>
  );
}

function EvidenceLine({ event, compact = false }) {
  const highTrust = highTrustSourceCount(event);
  const latest = formatTime(event.lastSeenAt);
  return (
    <div className={`evidence-line ${compact ? "compact" : ""}`}>
      <span>
        <Layers3 size={14} />
        来自 {event.sources.length} 个信源
      </span>
      <span>
        <ShieldCheck size={14} />
        {highTrust} 个高可信来源
      </span>
      <span>
        <Clock3 size={14} />
        最近更新 {latest}
      </span>
    </div>
  );
}

function EventDrawer({ event, onClose, onExplain, llmState }) {
  if (!event) return null;
  const timeline = [...event.relatedItems].sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
  const sourceNameById = Object.fromEntries(event.sources.map((source) => [source.id, source.name]));
  const llmText = llmState.eventId === event.id ? llmState.text : "";
  const llmParagraphs = llmText.split(/\n+/).filter(Boolean);
  const isLoading = llmState.loading && llmState.eventId === event.id;

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="event-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <button className="drawer-close" onClick={onClose} aria-label="关闭详情">
          <X size={18} />
        </button>
        <div className="drawer-header">
          <Tag tone={categoryTone[event.category]}>{event.category}</Tag>
          <TrustBadge event={event} />
          <h2>{event.title}</h2>
          <p>{event.summary}</p>
        </div>

        <section className="drawer-section">
          <h3>为什么重要</h3>
          <p>{event.whyItMatters}</p>
        </section>

        <section className="drawer-section">
          <div className="section-row">
            <h3>AI 分析</h3>
            <button className="small-action" onClick={() => onExplain(event.id)}>
              <Bot size={14} />
              {isLoading ? "生成中" : "生成分析"}
            </button>
          </div>
          {llmText ? (
            <div className="llm-answer">
              {llmParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          ) : (
            <p className="muted">点击生成分析。模型只基于当前事件摘要、信源和证据，不替代原始来源。</p>
          )}
        </section>

        <section className="drawer-section">
          <h3>为什么上榜</h3>
          <FactorList factors={event.scoreFactors} />
        </section>

        <section className="drawer-section">
          <h3>事件时间线</h3>
          <div className="timeline">
            {timeline.map((item) => (
              <article key={item.id}>
                <time>{formatTime(item.publishedAt)}</time>
                <div>
                  <strong>{sourceNameById[item.sourceId] ?? item.platform}</strong>
                  <p>{item.title}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="drawer-section">
          <h3>相关证据</h3>
          <div className="source-list">
            {event.relatedItems.map((item) => (
              <a key={item.id} href={item.url} target="_blank" rel="noreferrer">
                <span>{sourceNameById[item.sourceId] ?? item.platform}</span>
                <strong>{item.title}</strong>
              </a>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function TrustStrip({ snapshot }) {
  return (
    <section className="trust-strip">
      <div>
        <ShieldCheck size={18} />
        <strong>可信度不是一个分数，而是来源结构</strong>
        <span>首页会把来源层级和交叉验证情况翻译成更容易理解的可信提示。</span>
      </div>
      <div className="trust-items">
        <span>高可信 {snapshot.metrics.highTrust}</span>
        <span>多源验证 {snapshot.metrics.selected}</span>
        <span>持续观察 {snapshot.dailyBrief.watchList.length}</span>
      </div>
    </section>
  );
}

function TrendSection({ events }) {
  const rising = events.filter((event) => event.trend === "rising").slice(0, 3);
  const watch = events.filter((event) => event.trend === "volatile" || event.status === "watch").slice(0, 2);
  return (
    <section className="side-card">
      <SectionTitle eyebrow="Trend" title="趋势雷达" caption="看哪些正在升温，哪些还需要验证。" compact />
      <div className="trend-list">
        {[...rising, ...watch].map((event) => (
          <article key={event.id}>
            <span className={event.trend === "rising" ? "hot-dot" : "watch-dot"} />
            <div>
              <strong>{event.entities[0]}</strong>
              <p>{trendText(event.trend)} · 热度 {event.hotScore}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function BriefEntry({ brief, onOpenEvent }) {
  const items = brief.sections.flatMap((section) => section.events.slice(0, 1)).slice(0, 4);
  return (
    <section className="side-card brief-entry">
      <SectionTitle eyebrow="Daily Brief" title="今日简报" caption={formatTime(brief.generatedAt)} compact />
      <div className="brief-list">
        {items.map((event) => (
          <button key={event.id} onClick={() => onOpenEvent(event.id)}>
            <strong>{event.title}</strong>
            <span>{event.category} · 精选分 {event.selectedScore}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SearchSuggestion({ query, setQuery }) {
  const suggestions = ["Agent", "语音模型", "开源生态", "API 价格"];
  return (
    <section className="side-card">
      <SectionTitle eyebrow="Explore" title="快速探索" caption="用普通关键词开始，不需要懂数据字段。" compact />
      <div className="suggestion-list">
        {suggestions.map((item) => (
          <button key={item} className={query === item ? "active" : ""} onClick={() => setQuery(item)}>
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}

function BriefPage({ brief, events, onOpenEvent }) {
  return (
    <main className="simple-page">
      <SectionTitle eyebrow="Daily Brief" title={brief.title} caption={`生成时间 ${formatTime(brief.generatedAt)}`} />
      <div className="brief-page-grid">
        {brief.sections.map((section) => (
          <section key={section.category} className="brief-section-card">
            <h2>{section.category}</h2>
            {section.events.length ? (
              section.events.map((event) => (
                <button key={event.id} onClick={() => onOpenEvent(event.id)}>
                  <strong>{event.title}</strong>
                  <p>{event.whyItMatters}</p>
                </button>
              ))
            ) : (
              <p className="muted">当前没有进入日报的事件。</p>
            )}
          </section>
        ))}
      </div>
      <section className="brief-section-card full">
        <h2>持续观察</h2>
        <div className="watch-grid">
          {[...brief.watchList, ...events.filter((event) => event.trend === "cooling").slice(0, 2)].map((event) => (
            <button key={event.id} onClick={() => onOpenEvent(event.id)}>
              <TrustBadge event={event} />
              <strong>{event.title}</strong>
              <span>{event.summary}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function SourcesPage({ sources, sourceMix }) {
  return (
    <main className="simple-page">
      <SectionTitle eyebrow="Sources" title="信源说明" caption="首页只给普通用户看可信提示，详细等级保留在这里。" />
      <div className="source-explain-grid">
        <article>
          <ShieldCheck size={22} />
          <h2>高可信</h2>
          <p>官方博客、研究发布、官方社交和代码发布，适合做事实基础。</p>
        </article>
        <article>
          <Layers3 size={22} />
          <h2>多源验证</h2>
          <p>多个平台独立提及，同一事件不依赖单条消息判断。</p>
        </article>
        <article>
          <TrendingUp size={22} />
          <h2>社区热议</h2>
          <p>KOL、HN、YouTube、媒体适合判断扩散和讨论，但需要继续验证。</p>
        </article>
      </div>
      <section className="source-table-card">
        <h2>当前模拟信源</h2>
        <table>
          <thead>
            <tr>
              <th>信源</th>
              <th>等级</th>
              <th>平台</th>
              <th>类型</th>
              <th>24h</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id}>
                <td>{source.name}</td>
                <td>{source.tier}</td>
                <td>{source.platform}</td>
                <td>{source.type}</td>
                <td>{source.items24h}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="source-mix-list">
        {sourceMix.map((item) => (
          <span key={item.platform}>
            {item.platform} · {item.count}
          </span>
        ))}
      </div>
    </main>
  );
}

function AdminPage({ snapshot, onRecompute, onOpenEvent }) {
  return (
    <main className="admin-page">
      <div className="admin-head">
        <SectionTitle eyebrow="Admin" title="管理后台" caption="后台功能收敛在这里，不再主导普通用户首页。" />
        <button className="primary-action" onClick={onRecompute}>
          重新聚类和计分
        </button>
      </div>
      <div className="admin-metrics">
        <Metric label="信源数" value={snapshot.sources.length} />
        <Metric label="RawItem" value={snapshot.rawItems.length} />
        <Metric label="聚类数" value={snapshot.clusters.length} />
        <Metric label="精选事件" value={snapshot.metrics.selected} />
      </div>
      <section className="source-table-card">
        <h2>事件管理</h2>
        <table>
          <thead>
            <tr>
              <th>事件</th>
              <th>分类</th>
              <th>状态</th>
              <th>热度</th>
              <th>精选</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.events.map((event) => (
              <tr key={event.id}>
                <td>{event.title}</td>
                <td>{event.category}</td>
                <td>{event.status}</td>
                <td>{event.hotScore}</td>
                <td>{event.selectedScore}</td>
                <td>
                  <button className="table-action" onClick={() => onOpenEvent(event.id)}>
                    查看
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function SectionTitle({ eyebrow, title, caption, compact = false }) {
  return (
    <div className={`section-title ${compact ? "compact" : ""}`}>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {caption && <p>{caption}</p>}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Tag({ children, tone = "gray" }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

function TrustBadge({ event }) {
  return <span className={`trust-badge ${trustTone(event)}`}>{trustLabel(event)}</span>;
}

function FactorList({ factors }) {
  return (
    <div className="factor-list">
      {Object.entries(factors).map(([key, factor]) => (
        <div key={key} className="factor-row">
          <span>{factor.label}</span>
          <div>
            <i style={{ width: `${clamp(factor.value)}%` }} />
          </div>
          <strong>{factor.value}</strong>
        </div>
      ))}
    </div>
  );
}

function trustLabel(event) {
  if (event.primaryTier === "T1" || event.confidence >= 74) return "高可信";
  if (event.platformCount >= 3) return "多源验证";
  if (event.status === "watch" || event.trend === "volatile") return "待验证";
  return "社区热议";
}

function trustTone(event) {
  const label = trustLabel(event);
  if (label === "高可信") return "trusted";
  if (label === "多源验证") return "verified";
  if (label === "待验证") return "watch";
  return "community";
}

function highTrustSourceCount(event) {
  return event.sources.filter((source) => source.tier === "T1" || source.tier === "T1.5").length;
}

function trendText(trend) {
  return {
    rising: "正在升温",
    cooling: "热度回落",
    volatile: "持续观察",
    steady: "稳定传播"
  }[trend] ?? trend;
}

function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function cleanLlmText(text) {
  return String(text ?? "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clamp(value) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}
