import {
  Activity,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  Database,
  FileText,
  Filter,
  Flame,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  Newspaper,
  Radar,
  RefreshCcw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TableProperties,
  Zap
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

const frontNav = [
  { id: "dashboard", label: "驾驶舱", icon: LayoutDashboard },
  { id: "daily", label: "日报/趋势", icon: Newspaper },
  { id: "sources", label: "信源视图", icon: Database }
];

const adminNav = [
  { id: "admin-overview", label: "后台概况", icon: CircleGauge },
  { id: "admin-sources", label: "信源管理", icon: Settings2 },
  { id: "admin-events", label: "事件管理", icon: GitBranch },
  { id: "admin-rules", label: "规则管理", icon: SlidersHorizontal },
  { id: "admin-jobs", label: "数据任务", icon: ListChecks }
];

const categoryColors = {
  "模型发布": "cyan",
  "产品更新": "green",
  "行业动态": "amber",
  "开源生态": "rose"
};

export default function App() {
  const [snapshot, setSnapshot] = useState(fallbackSnapshot);
  const [activeView, setActiveView] = useState("dashboard");
  const [timeWindow, setTimeWindow] = useState("24h");
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");
  const [selectedEventId, setSelectedEventId] = useState(fallbackSnapshot.events[0]?.id);
  const [loading, setLoading] = useState(true);
  const [llmState, setLlmState] = useState({ loading: false, eventId: null, text: "" });
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetch("/api/snapshot")
      .then((response) => response.json())
      .then((data) => {
        setSnapshot(data);
        setSelectedEventId(data.events[0]?.id);
      })
      .catch(() => setSnapshot(fallbackSnapshot))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => ["全部", ...new Set(snapshot.events.map((event) => event.category))], [snapshot.events]);

  const filteredEvents = useMemo(() => {
    return snapshot.events.filter((event) => {
      const matchCategory = category === "全部" || event.category === category;
      const matchQuery =
        !query ||
        `${event.title} ${event.summary} ${event.entities.join(" ")}`.toLowerCase().includes(query.toLowerCase());
      return matchCategory && matchQuery;
    });
  }, [snapshot.events, category, query]);

  const selectedEvent = useMemo(() => {
    return snapshot.events.find((event) => event.id === selectedEventId) ?? snapshot.events[0];
  }, [selectedEventId, snapshot.events]);

  async function runRecompute() {
    setToast("正在模拟重新聚类与计分...");
    try {
      const response = await fetch("/api/jobs/recompute", { method: "POST" });
      const data = await response.json();
      if (data.snapshot) setSnapshot(data.snapshot);
      setToast(data.message || "已完成重新计算");
    } catch {
      setToast("本地 API 不可用，已继续使用前端模拟数据");
    }
    window.setTimeout(() => setToast(""), 2600);
  }

  async function explainWithLlm(eventId) {
    setLlmState({ loading: true, eventId, text: "" });
    try {
      const response = await fetch("/api/llm/event-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId })
      });
      const data = await response.json();
      setLlmState({ loading: false, eventId, text: data.text || "没有返回分析。" });
    } catch {
      setLlmState({
        loading: false,
        eventId,
        text: "LLM 接口暂不可用。MVP 已保留 OpenAI-compatible API 接入点，前端继续使用本地规则解释。"
      });
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Radar size={22} />
          </div>
          <div>
            <strong>AI Signal</strong>
            <span>24h Cockpit</span>
          </div>
        </div>

        <NavGroup title="前台" items={frontNav} activeView={activeView} onChange={setActiveView} />
        <NavGroup title="后台" items={adminNav} activeView={activeView} onChange={setActiveView} />

        <div className="sidebar-foot">
          <div className="status-dot" />
          <span>{loading ? "连接本地 API..." : "本地 MVP 运行中"}</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">AI / 科技热点情报系统</p>
            <h1>{viewTitle(activeView)}</h1>
          </div>
          <div className="topbar-actions">
            <Segmented
              options={[
                { label: "近 6 小时", value: "6h" },
                { label: "近 24 小时", value: "24h" },
                { label: "近 3 天", value: "3d" }
              ]}
              value={timeWindow}
              onChange={setTimeWindow}
            />
            <button className="button ghost" onClick={runRecompute}>
              <RefreshCcw size={16} />
              重算
            </button>
          </div>
        </header>

        {toast && <div className="toast">{toast}</div>}

        {activeView === "dashboard" && (
          <DashboardView
            snapshot={snapshot}
            events={filteredEvents}
            selectedEvent={selectedEvent}
            categories={categories}
            category={category}
            query={query}
            setCategory={setCategory}
            setQuery={setQuery}
            setSelectedEventId={setSelectedEventId}
            explainWithLlm={explainWithLlm}
            llmState={llmState}
          />
        )}

        {activeView === "daily" && (
          <DailyView
            brief={snapshot.dailyBrief}
            events={snapshot.events}
            onOpenEvent={(eventId) => {
              setSelectedEventId(eventId);
              setActiveView("dashboard");
            }}
          />
        )}
        {activeView === "sources" && <SourcesView sources={snapshot.sources} sourceMix={snapshot.sourceMix} />}
        {activeView.startsWith("admin") && (
          <AdminView
            activeView={activeView}
            snapshot={snapshot}
            setSelectedEventId={setSelectedEventId}
            setActiveView={setActiveView}
            onRecompute={runRecompute}
          />
        )}
      </main>
    </div>
  );
}

function NavGroup({ title, items, activeView, onChange }) {
  return (
    <section className="nav-group">
      <p>{title}</p>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            className={`nav-item ${activeView === item.id ? "active" : ""}`}
            onClick={() => onChange(item.id)}
          >
            <Icon size={17} />
            {item.label}
          </button>
        );
      })}
    </section>
  );
}

function DashboardView({
  snapshot,
  events,
  selectedEvent,
  categories,
  category,
  query,
  setCategory,
  setQuery,
  setSelectedEventId,
  explainWithLlm,
  llmState
}) {
  return (
    <div className="dashboard-grid">
      <section className="metrics-strip span-all">
        <MetricCard icon={Activity} label="原始信号" value={snapshot.metrics.rawItems} delta="+24" />
        <MetricCard icon={GitBranch} label="事件聚类" value={snapshot.metrics.clusters} delta="8 clusters" />
        <MetricCard icon={ShieldCheck} label="高可信事件" value={snapshot.metrics.highTrust} delta="T1/T1.5" />
        <MetricCard icon={Flame} label="上升事件" value={snapshot.metrics.rising} delta="rising" />
        <MetricCard icon={Sparkles} label="精选事件" value={snapshot.metrics.selected} delta="daily pool" />
      </section>

      <section className="panel command-panel span-all">
        <div className="filter-row">
          <div className="search-box">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索事件、实体、摘要" />
          </div>
          <div className="category-tabs">
            <Filter size={16} />
            {categories.map((item) => (
              <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel event-rank">
        <SectionHeader icon={Flame} title="24 小时事件热榜" caption="按热度分排序，点击查看事件解释" />
        <div className="event-list">
          {events.map((event, index) => (
            <EventCard key={event.id} event={event} rank={index + 1} onSelect={() => setSelectedEventId(event.id)} />
          ))}
        </div>
      </section>

      <section className="panel event-detail">
        <EventDetail event={selectedEvent} onExplain={explainWithLlm} llmState={llmState} />
      </section>

      <section className="panel intelligence-rail">
        <SectionHeader icon={BarChart3} title="趋势和信源矩阵" caption="不是只看点赞，而是看扩散结构" />
        <TrendBoard events={events} />
        <SourceMix sourceMix={snapshot.sourceMix} />
        <ClusterBoard clusters={snapshot.clusters} />
      </section>
    </div>
  );
}

function EventCard({ event, rank, onSelect }) {
  const tierSummary = ["T1", "T1.5", "T2"].map((tier) => `${tier}:${event.tierCoverage?.[tier] ?? 0}`).join(" / ");
  return (
    <button className="event-card" onClick={onSelect}>
      <div className="event-rank-no">#{rank}</div>
      <div className="event-card-main">
        <div className="event-card-head">
          <span className={`tag ${categoryColors[event.category] ?? "gray"}`}>{event.category}</span>
          <span className={`trend ${event.trend}`}>{trendLabel(event.trend)}</span>
        </div>
        <h3>{event.title}</h3>
        <p>{event.summary}</p>
        <div className="event-evidence">
          <span>{event.relatedItems.length} 条原始信号</span>
          <span>{event.sources.length} 个独立信源</span>
          <span>{tierSummary}</span>
        </div>
        <div className="event-meta">
          <span>{event.platforms.join(" / ")}</span>
          <span>代表源 {event.primarySource?.name ?? "未定"}</span>
          <span>更新 {formatTime(event.lastSeenAt)}</span>
          <span>可信度 {event.confidence}</span>
        </div>
      </div>
      <div className="score-stack">
        <ScoreBadge label="热" value={event.hotScore} />
        <ScoreBadge label="选" value={event.selectedScore} tone="select" />
      </div>
    </button>
  );
}

function EventDetail({ event, onExplain, llmState }) {
  if (!event) return null;
  const isLoading = llmState.loading && llmState.eventId === event.id;
  const hasLlmText = llmState.eventId === event.id && llmState.text;
  const sourceNameById = Object.fromEntries(event.sources.map((source) => [source.id, source.name]));
  const timeline = [...event.relatedItems].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
  return (
    <div className="detail-layout">
      <div className="detail-head">
        <div>
          <span className={`tag ${categoryColors[event.category] ?? "gray"}`}>{event.category}</span>
          <h2>{event.title}</h2>
        </div>
        <button className="button" onClick={() => onExplain(event.id)}>
          <Bot size={16} />
          {isLoading ? "分析中" : "LLM 分析"}
        </button>
      </div>

      <div className="score-grid">
        <ScoreBlock label="热度分" value={event.hotScore} />
        <ScoreBlock label="精选分" value={event.selectedScore} />
        <ScoreBlock label="可信度" value={event.confidence} />
        <ScoreBlock label="阈值" value={event.threshold} />
      </div>

      <div className="evidence-summary">
        <span>原始信号 {event.relatedItems.length}</span>
        <span>独立信源 {event.sources.length}</span>
        <span>平台 {event.platformCount}</span>
        <span>T1 {event.tierCoverage?.T1 ?? 0}</span>
        <span>T1.5 {event.tierCoverage?.["T1.5"] ?? 0}</span>
        <span>T2 {event.tierCoverage?.T2 ?? 0}</span>
        <span>代表源 {event.primarySource?.name ?? "未定"}</span>
        <span>最近更新 {formatTime(event.lastSeenAt)}</span>
      </div>

      <div className="factor-panel">
        <h4>热度分拆解</h4>
        <div className="factor-list">
          {Object.entries(event.scoreFactors).map(([key, factor]) => (
            <div key={key} className="factor-row">
              <div>
                <strong>{factor.label}</strong>
                <span>权重 {formatWeight(factor.weight)}</span>
              </div>
              <MiniBar value={factor.value} />
              <b>{factor.value}</b>
            </div>
          ))}
        </div>
        <h4 className="factor-subhead">精选分维度</h4>
        <div className="factor-list compact">
          {Object.entries(event.selectionFactors).map(([key, factor]) => (
            <div key={key} className="factor-row">
              <div>
                <strong>{factor.label}</strong>
                <span>{factor.weight === "rule" ? "规则项" : `权重 ${formatWeight(factor.weight)}`}</span>
              </div>
              <MiniBar value={factor.value} />
              <b>{factor.value}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="detail-copy">
        <h4>发生了什么</h4>
        <p>{event.summary}</p>
        <h4>为什么重要</h4>
        <p>{event.whyItMatters}</p>
      </div>

      <div className="explain-box">
        <h4>热度解释</h4>
        {event.scoreExplain.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>

      {hasLlmText && (
        <div className="llm-box">
          <h4>模型补充分析</h4>
          <p>{llmState.text}</p>
        </div>
      )}

      <div className="timeline-panel">
        <h4>事件时间线</h4>
        <div className="timeline-list">
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
      </div>

      <div>
        <h4 className="subhead">关联信号</h4>
        <div className="raw-list">
          {event.relatedItems.map((item) => (
            <a key={item.id} href={item.url} target="_blank" rel="noreferrer">
              <span>{sourceNameById[item.sourceId] ?? item.platform}</span>
              {item.title}
              <ChevronRight size={14} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrendBoard({ events }) {
  const top = events.slice(0, 6);
  return (
    <div className="trend-board">
      {top.map((event) => (
        <div key={event.id} className="trend-row">
          <div>
            <strong>{event.entities[0]}</strong>
            <span>{event.trend === "rising" ? "加速扩散" : event.trend === "volatile" ? "波动观察" : "稳定传播"}</span>
          </div>
          <MiniBar value={event.hotScore} />
        </div>
      ))}
    </div>
  );
}

function SourceMix({ sourceMix }) {
  const max = Math.max(...sourceMix.map((item) => item.count), 1);
  return (
    <div className="source-mix">
      <h4>平台来源分布</h4>
      {sourceMix.map((item) => (
        <div key={item.platform} className="mix-row">
          <span>{item.platform}</span>
          <div className="mix-track">
            <i style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <b>{item.count}</b>
        </div>
      ))}
    </div>
  );
}

function ClusterBoard({ clusters }) {
  return (
    <div className="cluster-board">
      <h4>聚类模拟</h4>
      {clusters.slice(0, 5).map((cluster) => (
        <div key={cluster.clusterId} className="cluster-row">
          <span>{cluster.itemCount} 条</span>
          <p>{cluster.primaryItem.title}</p>
          <small>{cluster.platforms.join(" / ")}</small>
        </div>
      ))}
    </div>
  );
}

function DailyView({ brief, events, onOpenEvent }) {
  const risingEvents = brief.risingEvents ?? events.filter((event) => event.trend === "rising").slice(0, 4);
  const coolingEvents = brief.coolingEvents ?? events.filter((event) => event.trend === "cooling").slice(0, 4);
  return (
    <div className="page-grid">
      <section className="panel span-8">
        <SectionHeader icon={FileText} title={brief.title} caption={`生成时间 ${formatTime(brief.generatedAt)}`} />
        <div className="brief-sections">
          {brief.sections.map((section) => (
            <div key={section.category} className="brief-section">
              <h3>{section.category}</h3>
              {section.events.length ? (
                section.events.map((event) => (
                  <button key={event.id} className="brief-event" onClick={() => onOpenEvent(event.id)}>
                    <div>
                      <strong>{event.title}</strong>
                      <p>{event.whyItMatters}</p>
                    </div>
                    <ScoreBadge value={event.selectedScore} label="选" tone="select" />
                  </button>
                ))
              ) : (
                <p className="muted">当前没有达到日报阈值的事件。</p>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="panel span-4">
        <SectionHeader icon={Zap} title="持续跟踪" caption="传闻、波动和未确认事件" />
        <div className="watch-list">
          {brief.watchList.map((event) => (
            <button key={event.id} className="watch-event" onClick={() => onOpenEvent(event.id)}>
              <span className="trend volatile">观察</span>
              <div>
                <h3>{event.title}</h3>
                <p>{event.summary}</p>
              </div>
            </button>
          ))}
        </div>
        <SectionHeader icon={Flame} title="升温事件" caption="进入驾驶舱查看完整证据链" compact />
        <div className="watch-list">
          {risingEvents.map((event) => (
            <button key={event.id} className="watch-event" onClick={() => onOpenEvent(event.id)}>
              <span className="trend rising">上升</span>
              <div>
                <h3>{event.title}</h3>
                <p>热度 {event.hotScore}，精选分 {event.selectedScore}</p>
              </div>
            </button>
          ))}
        </div>
        <SectionHeader icon={Activity} title="回落事件" caption="仍有价值，但不再占用首页优先级" compact />
        <div className="compact-list">
          {coolingEvents.map((event) => (
            <button key={event.id} onClick={() => onOpenEvent(event.id)}>
              {event.title}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function SourcesView({ sources, sourceMix }) {
  return (
    <div className="page-grid">
      <section className="panel span-8">
        <SectionHeader icon={Database} title="信源资产库" caption="MVP 用模拟源，后续替换为真实抓取适配器" />
        <table className="data-table">
          <thead>
            <tr>
              <th>信源</th>
              <th>等级</th>
              <th>平台</th>
              <th>类型</th>
              <th>权重</th>
              <th>24h</th>
              <th>延迟</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id}>
                <td>
                  <strong>{source.name}</strong>
                  <span>{source.owner}</span>
                </td>
                <td>
                  <TierPill tier={source.tier} />
                </td>
                <td>{source.platform}</td>
                <td>{source.type}</td>
                <td>{source.weight.toFixed(2)}</td>
                <td>{source.items24h}</td>
                <td>{source.latencyMin}m</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="panel span-4">
        <SectionHeader icon={BarChart3} title="信源结构" caption="用于判断跨平台扩散质量" />
        <SourceMix sourceMix={sourceMix} />
        <div className="source-policy">
          <h4>分级策略</h4>
          <p>T1：官网、研究博客、官方 release，优先当主条。</p>
          <p>T1.5：官方社交账号和代码发布，速度快但噪音更高。</p>
          <p>T2：KOL、媒体、社区、视频，适合判断扩散与讨论。</p>
        </div>
      </section>
    </div>
  );
}

function AdminView({ activeView, snapshot, setSelectedEventId, setActiveView, onRecompute }) {
  if (activeView === "admin-sources") {
    return <AdminSources sources={snapshot.sources} />;
  }
  if (activeView === "admin-events") {
    return <AdminEvents events={snapshot.events} setSelectedEventId={setSelectedEventId} setActiveView={setActiveView} />;
  }
  if (activeView === "admin-rules") {
    return <AdminRules rules={snapshot.rules} />;
  }
  if (activeView === "admin-jobs") {
    return <AdminJobs jobs={snapshot.jobs} onRecompute={onRecompute} />;
  }
  return <AdminOverview snapshot={snapshot} />;
}

function AdminOverview({ snapshot }) {
  return (
    <div className="page-grid">
      <section className="metrics-strip span-all">
        <MetricCard icon={Database} label="信源数" value={snapshot.sources.length} delta="12 enabled" />
        <MetricCard icon={TableProperties} label="RawItem" value={snapshot.rawItems.length} delta="mock" />
        <MetricCard icon={GitBranch} label="聚类数" value={snapshot.clusters.length} delta="replaceable" />
        <MetricCard icon={CheckCircle2} label="任务健康" value="3/4" delta="1 warning" />
      </section>
      <section className="panel span-7">
        <SectionHeader icon={ListChecks} title="待人工处理" caption="MVP 只做本地标记，不做账号体系" />
        <div className="admin-queue">
          {snapshot.events
            .filter((event) => event.status === "watch" || event.confidence < 70)
            .map((event) => (
              <article key={event.id}>
                <span className="trend volatile">待核实</span>
                <h3>{event.title}</h3>
                <p>{event.scoreExplain[2]}</p>
              </article>
            ))}
        </div>
      </section>
      <section className="panel span-5">
        <SectionHeader icon={Activity} title="最近任务" caption="抓取、聚类、计分、日报" />
        <JobList jobs={snapshot.jobs} />
      </section>
    </div>
  );
}

function AdminSources({ sources }) {
  return (
    <section className="panel">
      <SectionHeader icon={Settings2} title="信源管理" caption="MVP 展示增删改查界面形态，数据保存在前端状态中" />
      <div className="editable-grid">
        {sources.map((source) => (
          <article key={source.id} className="editable-card">
            <div>
              <strong>{source.name}</strong>
              <span>{source.platform} / {source.type}</span>
            </div>
            <TierPill tier={source.tier} />
            <label>
              权重
              <input type="range" min="0.5" max="1.5" step="0.01" defaultValue={source.weight} />
            </label>
            <button className="button ghost">{source.enabled ? "启用中" : "已停用"}</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminEvents({ events, setSelectedEventId, setActiveView }) {
  const [rowPatches, setRowPatches] = useState({});
  const rows = useMemo(() => events.map((event) => ({ ...event, ...rowPatches[event.id] })), [events, rowPatches]);

  function updateRow(eventId, patch) {
    setRowPatches((current) => ({
      ...current,
      [eventId]: {
        ...current[eventId],
        ...patch
      }
    }));
  }

  function cycleCategory(currentCategory) {
    const categories = Object.keys(categoryColors);
    const index = categories.indexOf(currentCategory);
    return categories[(index + 1) % categories.length];
  }

  return (
    <section className="panel">
      <SectionHeader icon={GitBranch} title="事件管理" caption="MVP 提供人工校正入口：精选、改分类、合并、拆分先写入本地审核状态" />
      <table className="data-table">
        <thead>
          <tr>
            <th>事件</th>
            <th>分类</th>
            <th>状态</th>
            <th>热度</th>
            <th>精选</th>
            <th>信源</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((event) => (
            <tr key={event.id}>
              <td>
                <strong>{event.title}</strong>
                <span>{event.entities.join(" / ")}</span>
              </td>
              <td>
                <span className={`tag ${categoryColors[event.category] ?? "gray"}`}>{event.category}</span>
              </td>
              <td>
                <strong>{event.status}</strong>
                <span>{event.reviewNote ?? event.scoreExplain[2]}</span>
              </td>
              <td>{event.hotScore}</td>
              <td>{event.selectedScore}</td>
              <td>
                <strong>{event.sources.length}</strong>
                <span>
                  T1 {event.tierCoverage?.T1 ?? 0} / T1.5 {event.tierCoverage?.["T1.5"] ?? 0} / T2 {event.tierCoverage?.T2 ?? 0}
                </span>
              </td>
              <td>
                <div className="table-actions">
                  <button
                    className="table-action"
                    onClick={() => {
                      setSelectedEventId(event.id);
                      setActiveView("dashboard");
                    }}
                  >
                    查看
                  </button>
                  <button
                    className="table-action ghost"
                    onClick={() =>
                      updateRow(event.id, {
                        status: event.status === "published" ? "watch" : "published",
                        reviewNote: event.status === "published" ? "人工撤出精选池" : "人工设为精选候选"
                      })
                    }
                  >
                    {event.status === "published" ? "撤精选" : "设精选"}
                  </button>
                  <button
                    className="table-action ghost"
                    onClick={() =>
                      updateRow(event.id, {
                        category: cycleCategory(event.category),
                        reviewNote: `人工改分类：${event.category} -> ${cycleCategory(event.category)}`
                      })
                    }
                  >
                    改分类
                  </button>
                  <button
                    className="table-action ghost"
                    onClick={() => updateRow(event.id, { reviewNote: "已加入合并候选队列，等待选择目标事件" })}
                  >
                    合并
                  </button>
                  <button className="table-action ghost" onClick={() => updateRow(event.id, { reviewNote: "已标记待拆分，进入聚类复核" })}>
                    拆分
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function AdminRules({ rules }) {
  const hotEntries = Object.entries(rules.hotScoreWeights);
  const selectEntries = Object.entries(rules.selectionWeights);
  return (
    <div className="page-grid">
      <section className="panel span-6">
        <SectionHeader icon={SlidersHorizontal} title="热度分权重" caption="代码公式控制最终分，模型只提供维度分" />
        <RuleSliders entries={hotEntries} />
      </section>
      <section className="panel span-6">
        <SectionHeader icon={Sparkles} title="精选分权重" caption="按类别阈值和信源等级判断是否进入精选" />
        <RuleSliders entries={selectEntries} />
      </section>
      <section className="panel span-all">
        <SectionHeader icon={ShieldCheck} title="精选阈值" caption="不同等级信源使用不同门槛，避免 KOL 二手消息挤占官方源" />
        <div className="threshold-row">
          {Object.entries(rules.thresholds).map(([tier, value]) => (
            <div key={tier}>
              <TierPill tier={tier} />
              <strong>{value}</strong>
              <MiniBar value={value} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminJobs({ jobs, onRecompute }) {
  return (
    <section className="panel">
      <SectionHeader icon={ListChecks} title="数据任务" caption="真实版本可替换为抓取队列、embedding 队列和日报任务" />
      <div className="job-actions">
        <button className="button" onClick={onRecompute}>
          <RefreshCcw size={16} />
          重新聚类和计分
        </button>
      </div>
      <JobList jobs={jobs} />
    </section>
  );
}

function JobList({ jobs }) {
  return (
    <div className="job-list">
      {jobs.map((job) => (
        <article key={job.id}>
          <span className={`job-status ${job.status}`}>{job.status}</span>
          <div>
            <strong>{job.name}</strong>
            <p>{job.result}</p>
          </div>
          <small>{job.durationMs}ms</small>
        </article>
      ))}
    </div>
  );
}

function RuleSliders({ entries }) {
  return (
    <div className="rule-list">
      {entries.map(([key, value]) => (
        <label key={key}>
          <span>{labelize(key)}</span>
          <input type="range" min="0" max="0.5" step="0.01" defaultValue={value} />
          <b>{value}</b>
        </label>
      ))}
    </div>
  );
}

function MetricCard({ icon, label, value, delta }) {
  const Icon = icon;
  return (
    <article className="metric-card">
      <div>
        <Icon size={18} />
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{delta}</small>
    </article>
  );
}

function SectionHeader({ icon, title, caption, compact = false }) {
  const Icon = icon;
  return (
    <div className={`section-header ${compact ? "compact" : ""}`}>
      <div>
        <Icon size={18} />
        <h2>{title}</h2>
      </div>
      <p>{caption}</p>
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button key={option.value} className={value === option.value ? "active" : ""} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ScoreBadge({ label, value, tone = "hot" }) {
  return (
    <span className={`score-badge ${tone}`}>
      {label} {value}
    </span>
  );
}

function ScoreBlock({ label, value }) {
  return (
    <div className="score-block">
      <span>{label}</span>
      <strong>{value}</strong>
      <MiniBar value={Number(value)} />
    </div>
  );
}

function MiniBar({ value }) {
  return (
    <div className="mini-bar">
      <i style={{ width: `${clamp(value)}%` }} />
    </div>
  );
}

function TierPill({ tier }) {
  return <span className={`tier-pill tier-${tier.replace(".", "")}`}>{tier}</span>;
}

function viewTitle(view) {
  const map = {
    dashboard: "24 小时事件驾驶舱",
    daily: "日报与趋势",
    sources: "信源视图",
    "admin-overview": "后台概况",
    "admin-sources": "信源管理",
    "admin-events": "事件管理",
    "admin-rules": "规则管理",
    "admin-jobs": "数据任务"
  };
  return map[view] ?? "AI Signal Cockpit";
}

function trendLabel(trend) {
  return {
    rising: "上升",
    cooling: "回落",
    volatile: "波动",
    steady: "稳定"
  }[trend] ?? trend;
}

function labelize(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase())
    .replace("cross Platform", "Cross Platform");
}

function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatWeight(value) {
  return `${Math.round(Number(value) * 100)}%`;
}

function clamp(value) {
  return Math.min(100, Math.max(0, value));
}
