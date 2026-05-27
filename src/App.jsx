import {
  CheckCircle2,
  Clock3,
  Database,
  Layers3,
  ExternalLink,
  MessageSquare,
  Search,
  ShieldCheck,
  TrendingUp,
  X
} from "lucide-react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { events as mockEvents, jobs as mockJobs, rawItems as mockRawItems, rules as mockRules, sources as mockSources } from "./data/mockData.js";
import { buildSnapshot } from "./lib/scoring.js";
import degotchiMarkUrl from "./assets/degotchi-mark-black.png";

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
  "开源生态": "violet",
  "论文研究": "sky",
  "技巧与观点": "slate"
};

const MotionDiv = motion.div;
const MotionSpan = motion.span;

const routeByView = {
  home: "/",
  brief: "/brief",
  sources: "/sources",
  feedback: "/feedback",
  admin: "/admin"
};

const FEED_BATCH_SIZE = 20;
const DEFAULT_AUTO_REFRESH_MS = 60 * 60 * 1000;
const THEME_STORAGE_KEY = "ai-hot-radar-theme";
const READ_STATE_STORAGE_KEY = "ai-hot-radar-read-state";

function viewFromPath(pathname) {
  if (pathname === "/brief" || pathname.startsWith("/brief/") || pathname.startsWith("/s/")) return "brief";
  if (pathname === "/sources") return "sources";
  if (pathname === "/admin") return "admin";
  return "home";
}

function briefKeyFromPath(pathname) {
  if (pathname.startsWith("/brief/")) return decodeURIComponent(pathname.split("/")[2] ?? "");
  if (pathname.startsWith("/s/")) return decodeURIComponent(pathname.split("/")[2] ?? "");
  return "";
}

export default function App() {
  const [snapshot, setSnapshot] = useState(fallbackSnapshot);
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const [query, setQuery] = useState("");
  const [briefFilter, setBriefFilter] = useState("全部");
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [feedbackOpen, setFeedbackOpen] = useState(() => window.location.pathname === routeByView.feedback);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [themeMode, setThemeMode] = useState(loadThemeMode);
  const [readState, setReadState] = useState(loadReadState);
  const [dailies, setDailies] = useState([]);
  const sessionLastReadEventIdRef = useRef(readState.lastReadEventId);

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      try {
        const [snapshotResponse, dailiesResponse] = await Promise.all([fetch("/api/snapshot"), fetch("/api/dailies?take=30")]);
        const [snapshotData, dailiesData] = await Promise.all([snapshotResponse.json(), dailiesResponse.json()]);
        if (cancelled) return;
        setSnapshot(snapshotData);
        if (Array.isArray(dailiesData.articles)) setDailies(dailiesData.articles);
      } catch {
        if (!cancelled) setSnapshot(fallbackSnapshot);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function applyTheme() {
      const resolvedTheme = themeMode === "system" ? (media.matches ? "dark" : "light") : themeMode;
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.dataset.themeMode = themeMode;
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    }
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem(READ_STATE_STORAGE_KEY, JSON.stringify(readState));
  }, [readState]);

  useEffect(() => {
    let cancelled = false;
    async function refreshQuietly() {
      try {
        const [snapshotResponse, dailiesResponse] = await Promise.all([fetch("/api/snapshot"), fetch("/api/dailies?take=30")]);
        const [snapshotData, dailiesData] = await Promise.all([snapshotResponse.json(), dailiesResponse.json()]);
        if (cancelled) return;
        setSnapshot(snapshotData);
        if (Array.isArray(dailiesData.articles)) setDailies(dailiesData.articles);
      } catch {
        if (!cancelled) setToast("自动刷新失败，继续显示上一批内容");
        window.setTimeout(() => setToast(""), 2400);
      }
    }
    const intervalMs = snapshot.refreshPolicy?.intervalMs || DEFAULT_AUTO_REFRESH_MS;
    const timer = window.setInterval(refreshQuietly, intervalMs);
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") refreshQuietly();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [snapshot.refreshPolicy?.intervalMs]);

  useEffect(() => {
    function handlePopState() {
      setCurrentPath(window.location.pathname);
      setFeedbackOpen(window.location.pathname === routeByView.feedback);
      setSelectedEventId(null);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [currentPath]);

  const selectedEvent = useMemo(() => {
    return snapshot.events.find((event) => event.id === selectedEventId) ?? null;
  }, [selectedEventId, snapshot.events]);

  const filteredEvents = useMemo(() => {
    return snapshot.events.filter((event) => {
      const keyword = [
        event.title,
        event.editorSummary ?? event.summary,
        event.editorInsight,
        event.editorDetail,
        ...(event.editorBullets ?? []),
        ...event.entities,
        ...(event.relatedItems ?? []).flatMap((item) => [item.title, item.summary, item.originalSource])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
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
    setToast("正在抓取真实信源并重新聚类...");
    try {
      const response = await fetch("/api/jobs/recompute", { method: "POST" });
      const data = await response.json();
      if (data.snapshot) setSnapshot(data.snapshot);
      const dailiesResponse = await fetch("/api/dailies?take=30");
      const dailiesData = await dailiesResponse.json();
      if (Array.isArray(dailiesData.articles)) setDailies(dailiesData.articles);
      setToast("已基于真实信源重新生成首页简报和事件排序");
    } catch {
      setToast("本地 API 暂不可用，首页保留最后一次数据");
    }
    window.setTimeout(() => setToast(""), 2400);
  }

  function navigateTo(nextView) {
    const nextPath = routeByView[nextView] ?? routeByView.home;
    navigateToPath(nextPath);
  }

  function navigateToPath(nextPath) {
    if (nextPath === window.location.pathname) return;
    window.history.pushState(null, "", nextPath);
    setCurrentPath(nextPath);
    setFeedbackOpen(nextPath === routeByView.feedback);
    setSelectedEventId(null);
  }

  function openEvent(eventId) {
    setSelectedEventId(eventId);
    setReadState((current) => markEventRead(current, eventId));
  }

  function openFeedback() {
    setFeedbackOpen(true);
  }

  function closeFeedback() {
    setFeedbackOpen(false);
    if (window.location.pathname === routeByView.feedback) {
      window.history.replaceState(null, "", routeByView.home);
      setCurrentPath(routeByView.home);
    }
  }

  const activeView = viewFromPath(currentPath);
  const activeBriefKey = briefKeyFromPath(currentPath);

  useEffect(() => {
    if (!activeBriefKey || dailies.some((article) => article.id === activeBriefKey || article.shortCode === activeBriefKey)) return;
    let cancelled = false;
    fetch(`/api/daily/${encodeURIComponent(activeBriefKey)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.article) setDailies((current) => [data.article, ...current]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeBriefKey, dailies]);

  const activeArticle =
    dailies.find((article) => article.id === activeBriefKey || article.shortCode === activeBriefKey) ??
    dailies[0] ??
    articleFromSnapshot(snapshot);
  const readIds = useMemo(() => new Set(readState.readIds), [readState.readIds]);

  return (
    <div className="product-shell">
      <AppHeader
        activeView={activeView}
        navigateTo={navigateTo}
        query={query}
        setQuery={setQuery}
        loading={loading}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
      />
      {toast && <div className="toast">{toast}</div>}

      {activeView === "home" && (
        <HomePage
          snapshot={snapshot}
          events={filteredEvents}
          briefFilter={briefFilter}
          setBriefFilter={setBriefFilter}
          onOpenEvent={openEvent}
          readIds={readIds}
          lastReadEventId={sessionLastReadEventIdRef.current}
        />
      )}

      {activeView === "brief" && (
        <BriefPage
          article={activeArticle}
          dailies={dailies}
          events={snapshot.events}
          onOpenEvent={openEvent}
          navigateToPath={navigateToPath}
        />
      )}

      {activeView === "sources" && <SourcesPage sources={snapshot.sources} sourceMix={snapshot.sourceMix} />}

      {activeView === "admin" && (
        <AdminPage snapshot={snapshot} onRecompute={runRecompute} onOpenEvent={openEvent} />
      )}

      {activeView !== "admin" && <FeedbackDock onOpen={openFeedback} />}
      {feedbackOpen && <FeedbackModal onClose={closeFeedback} />}
      <EventDrawer event={selectedEvent} onClose={() => setSelectedEventId(null)} />
    </div>
  );
}

function AppHeader({ activeView, navigateTo, query, setQuery, loading, themeMode, setThemeMode }) {
  const navItems = [
    { id: "home", label: "首页" },
    { id: "brief", label: "今日简报" },
    { id: "sources", label: "信源说明" }
  ];
  const editionStatus = loading ? "正在连接真实信源" : "实时电讯已更新";

  return (
    <header className="app-header">
      <div className="edition-strip" aria-label="报纸版面信息">
        <span>逮奇 / AI NEWSWIRE</span>
        <span>{formatNewspaperDate(new Date())}</span>
        <span>{editionStatus}</span>
      </div>

      <div className="masthead-row">
        <a className="brand-button" href={routeByView.home} onClick={(event) => handleRouteClick(event, "home", navigateTo)}>
          <span className="brand-logo">
            <img src={degotchiMarkUrl} alt="" />
          </span>
          <span>
            <strong>Radar.Degotchi</strong>
            <small>一份面向普通读者的 AI 科技报纸</small>
          </span>
        </a>

        <div className="header-search">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="检索报纸库：公司、模型、事件" />
        </div>

        <div className="masthead-tools">
          <nav className="header-nav" aria-label="主版面导航">
            {navItems.map((item) => (
              <a
                key={item.id}
                className={activeView === item.id ? "active" : ""}
                href={routeByView[item.id]}
                onClick={(event) => handleRouteClick(event, item.id, navigateTo)}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <ThemeSwitcher themeMode={themeMode} setThemeMode={setThemeMode} />
        </div>
      </div>
    </header>
  );
}

function ThemeSwitcher({ themeMode, setThemeMode }) {
  const options = [
    { id: "light", label: "日刊" },
    { id: "dark", label: "夜刊" }
  ];

  function commitTheme(nextMode) {
    const resolvedTheme = resolveThemeMode(nextMode);
    document.documentElement.setAttribute("data-theme", resolvedTheme);
    document.documentElement.setAttribute("data-theme-mode", nextMode);
    localStorage.setItem(THEME_STORAGE_KEY, nextMode);
    flushSync(() => setThemeMode(nextMode));
  }

  function handleThemeClick(event, nextMode) {
    if (themeMode === nextMode) return;

    const root = document.documentElement;
    const x = event.clientX;
    const y = event.clientY;
    const radius = Math.ceil(Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)));

    root.style.setProperty("--theme-reveal-x", `${x}px`);
    root.style.setProperty("--theme-reveal-y", `${y}px`);
    root.style.setProperty("--theme-reveal-radius", `${radius}px`);

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      commitTheme(nextMode);
      return;
    }

    if (!document.startViewTransition) {
      runFallbackThemeReveal({
        color: themeRevealColor(nextMode),
        onCommit: () => commitTheme(nextMode),
        radius,
        x,
        y
      });
      return;
    }

    document.startViewTransition(() => commitTheme(nextMode));
  }

  return (
    <div className="theme-switcher" aria-label="主题模式">
      {options.map((option) => (
        <button
          key={option.id}
          className={(themeMode === option.id || (themeMode === "system" && option.id === "light")) ? "active" : ""}
          onClick={(event) => handleThemeClick(event, option.id)}
          aria-pressed={themeMode === option.id}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function resolveThemeMode(mode) {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

function themeRevealColor(mode) {
  return resolveThemeMode(mode) === "dark" ? "#12100c" : "#e7ddc7";
}

function runFallbackThemeReveal({ color, onCommit, radius, x, y }) {
  const overlay = document.createElement("span");
  overlay.className = "theme-reveal-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.setProperty("--theme-reveal-color", color);
  overlay.style.setProperty("--theme-reveal-radius", `${radius}px`);
  overlay.style.setProperty("--theme-reveal-x", `${x}px`);
  overlay.style.setProperty("--theme-reveal-y", `${y}px`);
  document.body.appendChild(overlay);
  window.setTimeout(onCommit, 460);
  window.setTimeout(() => overlay.remove(), 720);
}

function handleRouteClick(event, view, navigateTo) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  navigateTo(view);
}

function HomePage({
  snapshot,
  events,
  briefFilter,
  setBriefFilter,
  onOpenEvent,
  readIds,
  lastReadEventId
}) {
  const feedTopRef = useRef(null);
  const loadMoreRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(FEED_BATCH_SIZE);
  const categories = ["全部", "正在升温", "持续观察", ...new Set(snapshot.events.map((event) => event.category))];
  const orderedEvents = useMemo(() => {
    return [...events].sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
  }, [events]);
  const loadedEvents = orderedEvents.slice(0, visibleCount);
  const visibleEnd = Math.min(visibleCount, orderedEvents.length);
  const hasMoreEvents = visibleEnd < orderedEvents.length;

  useEffect(() => {
    if (!hasMoreEvents || !loadMoreRef.current) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setVisibleCount((count) => Math.min(count + FEED_BATCH_SIZE, orderedEvents.length));
      },
      { rootMargin: "360px 0px 520px" }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [orderedEvents.length, hasMoreEvents]);

  function scrollFeedToTop() {
    const element = feedTopRef.current;
    if (!element) return;
    const targetTop = element.getBoundingClientRect().top + window.scrollY - 10;
    window.scrollTo({ top: Math.max(0, targetTop), left: 0, behavior: "auto" });
  }

  function handleFilterChange(category) {
    setBriefFilter(category);
    setVisibleCount(FEED_BATCH_SIZE);
    window.requestAnimationFrame(scrollFeedToTop);
  }

  return (
    <main className="home-page feed-page">
      <section className="feed-layout" ref={feedTopRef}>
        <section className="feed-main">
          <div className="feed-tab-sticky">
            <div className="filter-pills" role="tablist" aria-label="事件分类筛选">
              {categories.map((category) => (
                <button
                  key={category}
                  className={briefFilter === category ? "active" : ""}
                  aria-pressed={briefFilter === category}
                  onClick={() => handleFilterChange(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
          <EventFeed events={loadedEvents} onOpenEvent={onOpenEvent} readIds={readIds} lastReadEventId={lastReadEventId} />
          <FeedLoadMore
            loadMoreRef={loadMoreRef}
            hasMore={hasMoreEvents}
            visibleCount={visibleEnd}
            total={orderedEvents.length}
          />
        </section>
      </section>
    </main>
  );
}

function EventFeed({ events, onOpenEvent, readIds, lastReadEventId }) {
  const { scrollY } = useScroll();
  const dayX = useSpring(useTransform(scrollY, [0, 280], [0, -5]), { stiffness: 220, damping: 32, mass: 0.35 });
  const dayY = useSpring(useTransform(scrollY, [0, 280], [0, 4]), { stiffness: 240, damping: 30, mass: 0.35 });
  const dayOpacity = useSpring(useTransform(scrollY, [0, 280], [1, 0.86]), { stiffness: 220, damping: 28, mass: 0.35 });
  const ruleScale = useSpring(useTransform(scrollY, [0, 280], [0.72, 1]), { stiffness: 220, damping: 30, mass: 0.35 });

  if (!events.length) {
    return <div className="empty-state">没有匹配到事件，换个关键词试试。</div>;
  }
  const groups = groupTimelineEvents(events);
  return (
    <div className="timeline-feed">
      {groups.map((group) => (
        <section key={group.key} className="timeline-day">
          <TimelineDayLabel label={group.label} x={dayX} y={dayY} opacity={dayOpacity} ruleScale={ruleScale} />
          {group.items.map(({ event, rank }) => (
            <Fragment key={event.id}>
              {event.id === lastReadEventId && <LastReadMarker />}
              <EventTimelineItem event={event} rank={rank} onOpenEvent={onOpenEvent} isRead={readIds.has(event.id)} />
            </Fragment>
          ))}
        </section>
      ))}
    </div>
  );
}

function TimelineDayLabel({ label, x, y, opacity, ruleScale }) {
  return (
    <MotionDiv className="timeline-day-label" style={{ x, y, opacity }} aria-label={label}>
      <MotionSpan className="timeline-day-kicker" style={{ scaleX: ruleScale }} aria-hidden="true" />
      <span className="timeline-day-text">{label}</span>
      <MotionSpan className="timeline-day-rule" style={{ scaleX: ruleScale }} aria-hidden="true" />
    </MotionDiv>
  );
}

function LastReadMarker() {
  return (
    <div className="last-read-marker">
      <span />
      <strong>上次读到这里</strong>
      <span />
    </div>
  );
}

function FeedLoadMore({ loadMoreRef, hasMore, visibleCount, total }) {
  if (!total) return null;
  return (
    <div ref={hasMore ? loadMoreRef : null} className={`feed-load-more ${hasMore ? "" : "done"}`} aria-live="polite">
      <span>{hasMore ? `已显示 ${visibleCount} / ${total} 条` : `已显示全部 ${total} 条`}</span>
      {hasMore && <small>继续下滑加载下一批 20 条</small>}
    </div>
  );
}

function groupTimelineEvents(events) {
  const groups = [];
  const groupMap = new Map();
  events.forEach((event, index) => {
    const key = formatDayKey(event.lastSeenAt);
    if (!groupMap.has(key)) {
      const group = { key, label: formatDayLabel(event.lastSeenAt), items: [] };
      groupMap.set(key, group);
      groups.push(group);
    }
    groupMap.get(key).items.push({ event, rank: index + 1 });
  });
  return groups;
}

function EventTimelineItem({ event, rank, onOpenEvent, isRead }) {
  const readable = eventReadableFields(event);
  const primaryItem = event.relatedItems[0];
  return (
    <article
      className={`timeline-item ${event.trend} ${isRead ? "read" : "unread"}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpenEvent(event.id)}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") onOpenEvent(event.id);
      }}
    >
      <div className="timeline-time">
        <strong>{formatClock(event.lastSeenAt)}</strong>
        <span>{formatUpdateLabel(event.lastSeenAt)}</span>
      </div>
      <div className="timeline-node" aria-hidden="true" />
      <div className="timeline-card">
        <div className="timeline-card-head">
          <span className="rank-chip">#{rank}</span>
          <Tag tone={categoryTone[event.category]}>{event.category}</Tag>
          <span className={`trend-chip ${event.trend}`}>{trendText(event.trend)}</span>
          <TrustBadge event={event} />
          <span className={`read-chip ${isRead ? "read" : "unread"}`}>{isRead ? "已读" : "未读"}</span>
        </div>
        <h2>{readable.title}</h2>
        {readable.summary && <p className="timeline-summary">{readable.summary}</p>}
        {readable.why && (
          <p className="timeline-why">
            <CheckCircle2 size={15} />
            <span>{readable.why}</span>
          </p>
        )}
        <div className="timeline-footer">
          <div className="event-card-actions">
            {primaryItem && (
              <a
                href={primaryItem.url}
                target="_blank"
                rel="noreferrer"
                className="secondary-source-link"
                onClick={(clickEvent) => clickEvent.stopPropagation()}
              >
                <ExternalLink size={15} />
                打开原文
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function SourceDisclosure({ event, compact = false }) {
  const text = sourceDisclosureText(event);
  if (!text) return null;
  return (
    <p className={`source-disclosure ${compact ? "compact" : ""}`}>
      <Database size={14} />
      <span>{text}</span>
    </p>
  );
}

function EvidenceLine({ event, compact = false }) {
  const highTrust = highTrustSourceCount(event);
  const latest = formatUpdateLabel(event.lastSeenAt);
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

function EventDrawer({ event, onClose }) {
  if (!event) return null;
  const timeline = [...event.relatedItems].sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
  const sourceNameById = Object.fromEntries(event.sources.map((source) => [source.id, source.name]));
  const primaryItem = event.relatedItems[0];
  const readable = eventReadableFields(event);

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="event-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <button className="drawer-close" onClick={onClose} aria-label="关闭详情">
          <X size={18} />
        </button>
        <div className="drawer-header">
          <Tag tone={categoryTone[event.category]}>{event.category}</Tag>
          <span className={`trend-chip ${event.trend}`}>{trendText(event.trend)}</span>
          <TrustBadge event={event} />
          <h2>{readable.title}</h2>
          {readable.summary && <p>{readable.summary}</p>}
          <div className="drawer-actions">
            {primaryItem && (
              <a href={primaryItem.url} target="_blank" rel="noreferrer" className="drawer-source-link">
                <ExternalLink size={15} />
                打开原文
              </a>
            )}
          </div>
        </div>

        <section className="drawer-section">
          <h3>为什么重要</h3>
          <p>{readable.why || "目前抓到的信息还不足以提炼更多影响判断，建议先打开原文核验。"}</p>
          {readable.bullets.length > 0 && (
            <ul className="drawer-bullets">
              {readable.bullets.map((item) => (
                <li key={item}>
                  <CheckCircle2 size={15} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="drawer-section">
          <h3>完整概要</h3>
          <p>{readable.detail || "当前公开接口只提供标题、摘要或链接，暂未抓到更长正文；请通过下方来源打开原文查看完整内容。"}</p>
        </section>

        <section className="drawer-section">
          <h3>来源判断</h3>
          <EvidenceLine event={event} />
          <SourceDisclosure event={event} />
        </section>

        <section className="drawer-section">
          <h3>事件时间线</h3>
          <div className="timeline">
            {timeline.slice(0, 6).map((item) => (
              <article key={item.id}>
                <time>{formatTime(item.publishedAt)}</time>
                <div>
                  <strong>{sourceItemLabel(item, sourceNameById)}</strong>
                  <p>{item.title}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="drawer-section">
          <h3>已抓到的内容</h3>
          <div className="source-detail-list">
            {timeline.map((item) => {
              const snippet = sourceSnippetForDrawer(item, event, 260);
              return (
                <article key={item.id}>
                  <div className="source-detail-meta">
                    <time>{formatTime(item.publishedAt)}</time>
                    <span>{sourceContextLabel(item, sourceNameById)}</span>
                  </div>
                  <div>
                    <strong>{sourceItemLabel(item, sourceNameById)}</strong>
                    <h4>{item.title}</h4>
                    {snippet ? (
                      <p>{snippet}</p>
                    ) : (
                      <p className="source-snippet-empty">这条来源没有提供区别于标题的正文摘录，建议直接打开原文查看完整内容。</p>
                    )}
                    <a href={item.url} target="_blank" rel="noreferrer">
                      打开这一条来源
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </aside>
    </div>
  );
}

function BriefPage({ article, dailies, events, onOpenEvent, navigateToPath }) {
  const [activeCategory, setActiveCategory] = useState("全部");
  const [copied, setCopied] = useState(false);
  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const categories = ["全部", ...article.sections.map((section) => section.category)];
  const highlights = useMemo(() => (article.highlights ?? []).map((event) => hydrateBriefEvent(event, eventById)), [article.highlights, eventById]);
  const leadStory = highlights[0] ?? null;
  const secondaryStories = highlights.slice(1, 4);
  const highlightedIds = useMemo(() => new Set(highlights.map((event) => event.id)), [highlights]);
  const sections = useMemo(() => {
    const sourceSections =
      activeCategory === "全部"
        ? article.sections
        : article.sections.filter((section) => section.category === activeCategory);
    return sourceSections
      .map((section) => ({
        ...section,
        events: section.events
          .map((event) => hydrateBriefEvent(event, eventById))
          .filter((event) => activeCategory !== "全部" || !highlightedIds.has(event.id))
      }))
      .filter((section) => section.events.length > 0);
  }, [activeCategory, article.sections, eventById, highlightedIds]);
  const watchStories = useMemo(() => {
    const cooling = events.filter((event) => event.trend === "cooling").slice(0, 2).map(toFallbackBriefEvent);
    return dedupeEvents([...(article.watchList ?? []), ...cooling].map((event) => hydrateBriefEvent(event, eventById))).slice(0, 5);
  }, [article.watchList, eventById, events]);
  const allVisibleStories = [
    ...(leadStory ? [leadStory] : []),
    ...secondaryStories,
    ...sections.flatMap((section) => section.events),
    ...watchStories
  ];
  const footnotes = buildBriefFootnotes(allVisibleStories);
  const editionNumber = editionNumberFromId(article.id);
  const issueDate = formatNewspaperDate(article.windowEnd || article.generatedAt || article.id);
  const issueRange = `${formatDate(article.windowStart)} - ${formatDate(article.windowEnd)}`;

  async function copyShareLink() {
    const sharePath = article.shortPath || `/brief/${article.id}`;
    const shareUrl = new URL(sharePath, window.location.origin).href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        copyTextFallback(shareUrl);
      }
    } catch {
      copyTextFallback(shareUrl);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="brief-shell newspaper-shell">
      <aside className="brief-sidebar">
        <section>
          <h2>筛选</h2>
          <div className="brief-filter-list">
            {categories.map((category) => (
              <button key={category} className={activeCategory === category ? "active" : ""} onClick={() => setActiveCategory(category)}>
                {category}
              </button>
            ))}
          </div>
        </section>
        <section>
          <h2>以往每日简报</h2>
          <div className="brief-history-list">
            {dailies.map((item) => (
              <button
                key={item.id}
                className={item.id === article.id ? "active" : ""}
                onClick={() => navigateToPath(`/brief/${item.id}`)}
              >
                <strong>{item.id}</strong>
                <span>{item.eventCount} 条 · {formatDate(item.windowStart)} - {formatDate(item.windowEnd)}</span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <article className="brief-article newspaper-edition">
        <header className="newspaper-masthead">
          <div className="newspaper-topline">
            <span>第 {editionNumber} 期</span>
            <span>{issueDate}</span>
            <span>{browserTimeZoneLabel()}</span>
          </div>
          <div className="newspaper-nameplate">
            <span>AI</span>
            <h1>NEWS DAILY</h1>
            <span>24H</span>
          </div>
          <div className="newspaper-subline">
            <span>AI 科技日报</span>
            <span>{issueRange}</span>
            <span>{article.eventCount} 条入选 · {article.sourceCount} 个信源</span>
          </div>
        </header>

        <div className="newspaper-actions-row">
          <p>{article.lead}</p>
          <button className="brief-share-button" onClick={copyShareLink}>
            <ExternalLink size={15} />
            {copied ? "已复制短链" : "复制分享短链"}
          </button>
        </div>

        <div className="daily-article-body newspaper-body">
          {leadStory && activeCategory === "全部" && (
            <section className="newspaper-frontpage">
              <NewspaperLeadStory event={leadStory} onOpenEvent={onOpenEvent} />
              <aside className="newspaper-briefs">
                <span className="newspaper-section-label">INSIDE TODAY</span>
                <h2>今日侧栏</h2>
                {secondaryStories.map((event, index) => (
                  <NewspaperBriefItem key={event.id} event={event} index={index + 1} onOpenEvent={onOpenEvent} />
                ))}
              </aside>
            </section>
          )}

          <section className="newspaper-section-map">
            <span className="newspaper-section-label">SECTIONS</span>
            <div>
              {sections.map((section) => (
                <a key={section.category} href={`#daily-${section.category}`}>
                  {section.category}
                  <small>{section.events.length}</small>
                </a>
              ))}
            </div>
          </section>

          {sections.map((section, index) => (
            <NewspaperSection key={section.category} section={section} index={index + 1} onOpenEvent={onOpenEvent} />
          ))}

          {watchStories.length > 0 && (
            <section className="newspaper-watch-strip">
              <div>
                <span className="newspaper-section-label">WATCH LIST</span>
                <h2>持续观察</h2>
              </div>
              <div className="newspaper-watch-grid">
                {watchStories.map((event, index) => (
                  <NewspaperBriefItem key={event.id} event={event} index={index + 1} onOpenEvent={onOpenEvent} compact />
                ))}
              </div>
            </section>
          )}

          <SourceFootnotes footnotes={footnotes} />
        </div>
      </article>
    </main>
  );
}

function NewspaperLeadStory({ event, onOpenEvent }) {
  const summary = storySummary(event);
  const why = storyWhy(event);
  return (
    <button className="newspaper-lead-story" onClick={() => onOpenEvent(event.id)}>
      <span className="newspaper-section-label">LEAD STORY</span>
      <h2>{event.title}</h2>
      {summary && <p className="newspaper-lead-summary">{summary}</p>}
      {why && (
        <p className="newspaper-importance">
          <strong>为什么重要</strong>
          <span>{why}</span>
        </p>
      )}
      <div className="newspaper-story-meta">
        <span>{event.category}</span>
        <span>{event.trustLabel}</span>
        <span>{sourceBriefText(event)}</span>
        {event.lastSeenAt && <span>{formatUpdatedText(event.lastSeenAt)}</span>}
      </div>
    </button>
  );
}

function NewspaperSection({ section, index, onOpenEvent }) {
  return (
    <section className="newspaper-news-section" id={`daily-${section.category}`}>
      <header>
        <span>{String(index).padStart(2, "0")}</span>
        <div>
          <small>{section.events.length} 条</small>
          <h2>{section.category}</h2>
        </div>
      </header>
      <div className="newspaper-column-grid">
        {section.events.map((event, eventIndex) => (
          <NewspaperArticle key={event.id} event={event} index={eventIndex + 1} onOpenEvent={onOpenEvent} />
        ))}
      </div>
    </section>
  );
}

function NewspaperArticle({ event, index, onOpenEvent }) {
  const summary = storySummary(event);
  const why = storyWhy(event);
  return (
    <button className="newspaper-article-card" onClick={() => onOpenEvent(event.id)}>
      <span className="newspaper-article-number">{String(index).padStart(2, "0")}</span>
      <div className="newspaper-story-meta">
        <span>{event.trustLabel}</span>
        <span>{sourceBriefText(event)}</span>
      </div>
      <h3>{event.title}</h3>
      {summary && <p>{summary}</p>}
      {why && <small>重要性：{why}</small>}
    </button>
  );
}

function NewspaperBriefItem({ event, index, onOpenEvent, compact = false }) {
  return (
    <button className={`newspaper-brief-item ${compact ? "compact" : ""}`} onClick={() => onOpenEvent(event.id)}>
      <span>{String(index).padStart(2, "0")}</span>
      <div>
        <strong>{event.title}</strong>
        <small>{event.category} · {event.trustLabel} · {sourceBriefText(event)}</small>
      </div>
    </button>
  );
}

function SourceFootnotes({ footnotes }) {
  if (!footnotes.length) return null;
  return (
    <footer className="newspaper-footnotes">
      <div>
        <span className="newspaper-section-label">SOURCE NOTES</span>
        <h2>来源脚注</h2>
      </div>
      <ol>
        {footnotes.map((item, index) => (
          <li key={item.url || `${item.label}-${index}`}>
            <a href={item.url} target="_blank" rel="noreferrer">
              [{index + 1}] {item.label}
            </a>
            <span>{item.context}</span>
          </li>
        ))}
      </ol>
    </footer>
  );
}

function SourcesPage({ sources, sourceMix }) {
  return (
    <main className="simple-page">
      <SectionTitle title="信源说明" caption="当前接入的公开来源，以及每类来源适合用来判断什么。" />
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
        <h2>当前真实信源</h2>
        <table>
          <thead>
            <tr>
              <th>信源</th>
              <th>等级</th>
              <th>平台</th>
              <th>类型</th>
              <th>24h</th>
              <th>状态</th>
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
                <td>{source.lastFetchStatus ?? "内置"}</td>
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
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/feedback?take=100")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.feedback)) setFeedbackItems(data.feedback);
      })
      .catch(() => {
        if (!cancelled) setFeedbackItems([]);
      })
      .finally(() => {
        if (!cancelled) setFeedbackLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      <section className="source-table-card feedback-admin-card">
        <h2>反馈建议</h2>
        {feedbackLoading ? (
          <p className="admin-muted">正在读取本地反馈...</p>
        ) : feedbackItems.length ? (
          <div className="feedback-list">
            {feedbackItems.map((item) => (
              <article key={item.id} className="feedback-admin-item">
                <div>
                  <strong>{item.title}</strong>
                  <time>{formatTime(item.createdAt)}</time>
                </div>
                <p>{item.content}</p>
                {item.email && <span>{item.email}</span>}
              </article>
            ))}
          </div>
        ) : (
          <p className="admin-muted">暂无反馈。</p>
        )}
      </section>
    </main>
  );
}

function FeedbackDock({ onOpen }) {
  return (
    <button className="feedback-dock" type="button" onClick={onOpen}>
      <MessageSquare size={15} />
      反馈建议
    </button>
  );
}

function FeedbackModal({ onClose }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ type: "idle", message: "" });

  async function submitFeedback(event) {
    event.preventDefault();
    setStatus({ type: "loading", message: "正在保存..." });
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, email })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "feedback_failed");
      setTitle("");
      setContent("");
      setEmail("");
      setStatus({ type: "success", message: "已收到，感谢反馈。" });
    } catch {
      setStatus({ type: "error", message: "保存失败，请稍后再试。" });
    }
  }

  return (
    <div className="feedback-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="feedback-card feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="drawer-close feedback-close" type="button" onClick={onClose} aria-label="关闭反馈">
          <X size={18} />
        </button>
        <SectionTitle
          eyebrow="Feedback"
          title="反馈建议"
          caption="写下你希望逮奇雷达改进的地方。标题和内容必填，邮箱选填。"
          titleId="feedback-title"
        />
        <form className="feedback-form" onSubmit={submitFeedback}>
          <label>
            <span>标题</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
          </label>
          <label>
            <span>内容</span>
            <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={2400} rows={8} required />
          </label>
          <label>
            <span>邮箱（选填）</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} maxLength={160} type="email" />
          </label>
          <div className="feedback-form-actions">
            <button className="primary-action" disabled={status.type === "loading"} type="submit">
              提交反馈
            </button>
            {status.message && <p className={`feedback-status ${status.type}`}>{status.message}</p>}
          </div>
        </form>
      </section>
    </div>
  );
}

function SectionTitle({ eyebrow, title, caption, compact = false, titleId }) {
  return (
    <div className={`section-title ${compact ? "compact" : ""}`}>
      {eyebrow && <span>{eyebrow}</span>}
      <h2 id={titleId}>{title}</h2>
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

function displayTitle(event) {
  const title = cleanText(event.title, 90);
  const summary = cleanText(event.editorSummary || event.summary, 46).replace(/[。.!！?？]+$/g, "");
  if (isMostlyLatin(title) && hasCjk(summary)) return summary;
  return title;
}

function isMostlyLatin(value) {
  const text = String(value ?? "").replace(/\s+/g, "");
  if (!text) return false;
  const latin = (text.match(/[A-Za-z0-9]/g) ?? []).length;
  const cjk = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  return latin > 0 && latin > cjk * 2;
}

function hasCjk(value) {
  return /[\u3400-\u9fff]/.test(String(value ?? ""));
}

function eventBullets(event) {
  const candidates = [
    ...(event.editorBullets ?? []),
    ...(event.relatedItems ?? []).flatMap((item) => [sourceSnippet(item, 130), item.title])
  ];
  return dedupeText(
    candidates
      .map((item) => cleanText(item, 130))
      .filter(
        (item) =>
          item &&
          normalizeText(item) !== normalizeText(event.title) &&
          normalizeText(item) !== normalizeText(event.editorInsight) &&
          normalizeText(item) !== normalizeText(event.editorSummary || event.summary)
      )
  ).slice(0, 3);
}

function eventReadableFields(event) {
  const title = displayTitle(event);
  const summary = pickDistinctText(
    [
      event.editorSummary,
      event.summary,
      ...(event.relatedItems ?? []).map((item) => item.summary)
    ],
    [title],
    190
  );
  const why = pickDistinctText(
    [event.editorInsight, ...(event.editorBullets ?? []), ...eventBullets(event)],
    [title, summary],
    150
  );
  const bullets = eventBullets(event).filter((item) => !isDuplicateText(item, [title, summary, why])).slice(0, 3);
  const detail = pickDistinctText(
    [
      event.editorDetail,
      ...bullets,
      ...(event.relatedItems ?? []).map((item) => item.summary)
    ],
    [title, summary, why],
    300
  );
  return { title, summary, why, detail, bullets };
}

function sourceSnippet(item, maxLength = 180) {
  const summary = cleanText(item.summary, maxLength);
  if (summary && normalizeText(summary) !== normalizeText(item.title)) return summary;
  return cleanText(item.title, maxLength);
}

function sourceSnippetForDrawer(item, event, maxLength = 240) {
  return pickDistinctText(
    [item.summary],
    [
      item.title,
      displayTitle(event),
      event.editorSummary,
      event.summary,
      event.editorInsight,
      event.editorDetail,
      ...(event.editorBullets ?? [])
    ],
    maxLength
  );
}

function sourceItemLabel(item, sourceNameById) {
  const sourceName = sourceNameById[item.sourceId] ?? item.platform;
  if (item.originalSource && !/^HN points/i.test(item.originalSource)) {
    return isXUrl(item) && !/^X[:：]/i.test(item.originalSource) ? `X：${item.originalSource}` : item.originalSource;
  }
  return sourceName;
}

function sourceContextLabel(item, sourceNameById) {
  const sourceName = sourceNameById[item.sourceId] ?? item.platform;
  const originalSource = item.originalSource || "";
  if (item.platform === "AIHOT" && (isXUrl(item) || /^X[:：]/i.test(originalSource))) return `${sourceName} 整理/翻译`;
  if (item.platform === "AIHOT") return `${sourceName} 聚合整理`;
  if (isXUrl(item)) return "X 原帖";
  if (/youtube\.com|youtu\.be/i.test(item.url)) return "视频标题/说明";
  if (/github\.com/i.test(item.url)) return "代码仓库/发布页";
  if (/arxiv\.org/i.test(item.url)) return "论文页";
  return item.platform;
}

function sourceDisclosureText(event) {
  const aihotXCount = (event.relatedItems ?? []).filter(
    (item) => item.platform === "AIHOT" && (isXUrl(item) || /^X[:：]/i.test(item.originalSource || ""))
  ).length;
  if (aihotXCount) {
    return `${aihotXCount} 条 X 来源来自 AIHOT 聚合源，标题和摘要可能已被中文整理；“打开原文”会跳到对应 X 页面核验。`;
  }
  const aggregatorCount = (event.sources ?? []).filter((source) => source.type === "aggregator").length;
  if (aggregatorCount) return "包含聚合源整理内容，建议把聚合摘要和原始链接一起看。";
  return "";
}

function isXUrl(item) {
  return /(^|\.)x\.com\/|twitter\.com\//i.test(item.url || "");
}

function cleanText(value, maxLength = 180) {
  const text = String(value ?? "")
    .replace(/^(?=[\s\S]{0,340}(?:aside_block|btn_text|href|image))[\s\S]{0,340}?\)\]>\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(/https?\s*[：:]\s*\/\/\S+/gi, "")
    .trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function dedupeText(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const key = normalizeText(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function trendText(trend) {
  return {
    rising: "正在升温",
    cooling: "热度回落",
    volatile: "持续观察",
    steady: "稳定传播",
    watch: "持续观察"
  }[trend] ?? trend;
}

function articleFromSnapshot(snapshot) {
  const brief = snapshot.dailyBrief;
  const sections = brief.sections.map((section) => ({
    category: section.category,
    events: section.events.map(toFallbackBriefEvent)
  }));
  const highlights = sections.flatMap((section) => section.events).slice(0, 4);
  return {
    id: new Date(brief.generatedAt).toISOString().slice(0, 10),
    shortCode: "today",
    shortPath: "/brief",
    title: brief.title,
    subtitle: "04:00 自动汇总过去 24 小时的 AI 和科技热点",
    generatedAt: brief.generatedAt,
    scheduledAt: brief.generatedAt,
    windowStart: new Date(new Date(brief.generatedAt).getTime() - 24 * 60 * 60 * 1000).toISOString(),
    windowEnd: brief.generatedAt,
    eventCount: highlights.length,
    sourceCount: new Set(highlights.map((event) => event.id)).size,
    lead: highlights[0]?.summary || "今日简报正在生成中。",
    highlights,
    sections,
    watchList: brief.watchList.map(toFallbackBriefEvent),
    tags: []
  };
}

function toFallbackBriefEvent(event) {
  return {
    id: event.id,
    title: displayTitle(event),
    category: event.category,
    summary: event.editorSummary || event.summary,
    insight: event.editorInsight || event.editorSummary || event.summary,
    trustLabel: trustLabel(event),
    lastSeenAt: event.lastSeenAt,
    sourceCount: event.sources?.length ?? event.sourceIds?.length ?? 0,
    highTrustSourceCount: highTrustSourceCount(event),
    primaryUrl: event.relatedItems?.[0]?.url ?? ""
  };
}

function hydrateBriefEvent(event, eventById) {
  const fullEvent = eventById.get(event.id);
  if (!fullEvent) {
    return {
      ...event,
      title: cleanText(event.title, 120),
      summary: cleanText(event.summary, 180),
      insight: cleanText(event.insight, 120),
      fullEvent: null
    };
  }

  return {
    ...event,
    title: displayTitle(fullEvent),
    category: fullEvent.category || event.category,
    summary: fullEvent.editorSummary || event.summary || fullEvent.summary,
    insight: fullEvent.editorInsight || event.insight,
    trustLabel: trustLabel(fullEvent),
    lastSeenAt: fullEvent.lastSeenAt || event.lastSeenAt,
    sourceCount: fullEvent.sources?.length ?? event.sourceCount ?? 0,
    highTrustSourceCount: highTrustSourceCount(fullEvent),
    primaryUrl: fullEvent.relatedItems?.[0]?.url ?? event.primaryUrl ?? "",
    fullEvent
  };
}

function storySummary(event) {
  return pickDistinctText(
    [
      event.summary,
      event.fullEvent?.editorSummary,
      event.fullEvent?.summary,
      event.fullEvent?.relatedItems?.find((item) => normalizeText(item.summary) !== normalizeText(item.title))?.summary
    ],
    [event.title, event.insight],
    210
  );
}

function storyWhy(event) {
  return pickDistinctText(
    [
      event.insight,
      event.fullEvent?.editorInsight,
      event.fullEvent?.editorBullets?.[0],
      event.fullEvent ? eventBullets(event.fullEvent)[0] : ""
    ],
    [event.title, event.summary],
    140
  );
}

function sourceBriefText(event) {
  const sourceCount = event.fullEvent?.sources?.length ?? event.sourceCount ?? 0;
  const highTrust = event.fullEvent ? highTrustSourceCount(event.fullEvent) : event.highTrustSourceCount ?? 0;
  if (!sourceCount) return "来源待补";
  if (sourceCount === 1) return highTrust ? "1 个高可信来源" : "1 个来源";
  return `${sourceCount} 个来源 · ${highTrust} 个高可信`;
}

function buildBriefFootnotes(stories) {
  const items = [];
  const seen = new Set();
  for (const story of stories) {
    const relatedItems = story.fullEvent?.relatedItems ?? [];
    const sourceNameById = Object.fromEntries((story.fullEvent?.sources ?? []).map((source) => [source.id, source.name]));
    for (const item of relatedItems) {
      const url = item.url || "";
      const key = url || `${story.id}:${item.id}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push({
        label: sourceItemLabel(item, sourceNameById),
        context: sourceContextLabel(item, sourceNameById),
        url
      });
      if (items.length >= 12) return items;
    }
  }
  return items;
}

function dedupeEvents(events) {
  const seen = new Set();
  const result = [];
  for (const event of events) {
    if (!event.id || seen.has(event.id)) continue;
    seen.add(event.id);
    result.push(event);
  }
  return result;
}

function pickDistinctText(candidates, blockers = [], maxLength = 180) {
  const normalizedBlockers = blockers.map(normalizeText).filter(Boolean);
  for (const candidate of candidates.flat().filter(Boolean)) {
    const text = cleanText(candidate, maxLength);
    const normalized = normalizeText(text);
    if (!normalized) continue;
    const repeatsBlocker = normalizedBlockers.some((blocker) => isNearDuplicateKey(normalized, blocker));
    if (!repeatsBlocker) return text;
  }
  return "";
}

function isDuplicateText(value, blockers = []) {
  const normalized = normalizeText(value);
  if (!normalized) return true;
  return blockers.map(normalizeText).filter(Boolean).some((blocker) => isNearDuplicateKey(normalized, blocker));
}

function isNearDuplicateKey(a, b) {
  if (!a || !b) return false;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  return a === b || longer.includes(shorter) || shorter.length / longer.length > 0.72 && longestCommonPrefixLength(a, b) / shorter.length > 0.72;
}

function longestCommonPrefixLength(a, b) {
  let index = 0;
  while (index < a.length && index < b.length && a[index] === b[index]) index += 1;
  return index;
}

function editionNumberFromId(id) {
  const date = toValidDate(id);
  if (!date) return "000";
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - yearStart) / (24 * 60 * 60 * 1000)) + 1;
  return String(dayOfYear).padStart(3, "0");
}

function formatNewspaperDate(value) {
  const date = toValidDate(value);
  if (!date) return "日期待定";
  return new Intl.DateTimeFormat(getBrowserLocale(), {
    timeZone: getBrowserTimeZone(),
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(date);
}

function loadThemeMode() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return ["system", "light", "dark"].includes(stored) ? stored : "system";
}

function loadReadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(READ_STATE_STORAGE_KEY) || "{}");
    return {
      readIds: Array.isArray(parsed.readIds) ? parsed.readIds : [],
      lastReadEventId: parsed.lastReadEventId || "",
      lastReadAt: parsed.lastReadAt || ""
    };
  } catch {
    return { readIds: [], lastReadEventId: "", lastReadAt: "" };
  }
}

function markEventRead(current, eventId) {
  const readIds = current.readIds.includes(eventId) ? current.readIds : [eventId, ...current.readIds].slice(0, 500);
  return {
    readIds,
    lastReadEventId: eventId,
    lastReadAt: new Date().toISOString()
  };
}

function copyTextFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function getBrowserLocale() {
  return typeof navigator === "undefined" ? "zh-CN" : navigator.language || "zh-CN";
}

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
  } catch {
    return "Asia/Shanghai";
  }
}

function browserTimeZoneLabel(value = new Date()) {
  const timeZone = getBrowserTimeZone();
  try {
    const offsetPart = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset"
    })
      .formatToParts(new Date(value))
      .find((part) => part.type === "timeZoneName")?.value;
    if (offsetPart) return offsetPart.replace("GMT", "UTC");
  } catch {
    // Some Safari/Chromium builds do not expose shortOffset; fall back to the IANA name.
  }
  return timeZone;
}

function toValidDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(value) {
  const date = toValidDate(value);
  if (!date) return "时间未知";
  return new Intl.DateTimeFormat(getBrowserLocale(), {
    timeZone: getBrowserTimeZone(),
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function formatDate(value) {
  const date = toValidDate(value);
  if (!date) return "未知日期";
  return new Intl.DateTimeFormat(getBrowserLocale(), {
    timeZone: getBrowserTimeZone(),
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function formatClock(value) {
  const date = toValidDate(value);
  if (!date) return "--:--";
  return new Intl.DateTimeFormat(getBrowserLocale(), {
    timeZone: getBrowserTimeZone(),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function formatDayKey(value) {
  const date = toValidDate(value);
  if (!date) return "unknown";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: getBrowserTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function formatDayLabel(value) {
  const date = toValidDate(value);
  if (!date) return "时间未知";
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: getBrowserTimeZone(),
    weekday: "short"
  }).format(date);
  const monthDay = new Intl.DateTimeFormat("en-US", {
    timeZone: getBrowserTimeZone(),
    month: "2-digit",
    day: "2-digit"
  }).format(date);
  return `${weekday}, ${monthDay}`;
}

function formatUpdateLabel(value) {
  const date = toValidDate(value);
  if (!date) return "时间未知";
  const diffMs = Date.now() - date.getTime();
  if (diffMs >= 0 && diffMs < 60 * 1000) return "刚刚";
  if (diffMs >= 0 && diffMs < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diffMs / 60000))} 分钟前`;
  if (diffMs >= 0 && diffMs < 24 * 60 * 60 * 1000) return `${Math.max(1, Math.floor(diffMs / 36e5))} 小时前`;
  if (diffMs >= 0 && diffMs < 48 * 60 * 60 * 1000) return `昨天 ${formatClock(value)}`;
  return formatTime(value);
}

function formatUpdatedText(value) {
  const label = formatUpdateLabel(value);
  if (label === "刚刚") return "刚刚更新";
  if (label === "时间未知") return label;
  return `${label} 更新`;
}

function clamp(value) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}
