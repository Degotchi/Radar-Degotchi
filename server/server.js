import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { events, jobs, rawItems, rules, sources } from "../src/data/mockData.js";
import { buildSnapshot } from "../src/lib/scoring.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    modelConfigured: Boolean(process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL),
    model: process.env.LLM_MODEL || null
  });
});

app.get("/api/snapshot", (_req, res) => {
  res.json(buildSnapshot({ events, sources, rawItems, rules, jobs }));
});

app.post("/api/jobs/recompute", (_req, res) => {
  const snapshot = buildSnapshot({ events, sources, rawItems, rules, jobs });
  res.json({
    ok: true,
    message: "本地模拟完成：重新聚类、重新计分、重新生成日报。",
    snapshot
  });
});

app.post("/api/llm/event-summary", async (req, res) => {
  const { eventId } = req.body ?? {};
  const snapshot = buildSnapshot({ events, sources, rawItems, rules, jobs });
  const event = snapshot.events.find((item) => item.id === eventId) ?? snapshot.events[0];

  if (!event) {
    res.status(404).json({ ok: false, error: "event_not_found" });
    return;
  }

  try {
    const text = await callLlmForEvent(event);
    res.json({ ok: true, eventId: event.id, text, provider: process.env.LLM_BASE_URL });
  } catch (error) {
    res.json({
      ok: false,
      eventId: event.id,
      text: fallbackSummary(event),
      error: error.message
    });
  }
});

async function callLlmForEvent(event) {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;

  if (!baseUrl || !apiKey || !model) {
    throw new Error("LLM environment variables are not configured");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "你是 AI/科技情报产品的事件分析助手。输出务实、简洁、可验证，不要夸张。"
        },
        {
          role: "user",
          content: `请基于以下事件，生成一段给驾驶舱使用的中文分析，包含：发生了什么、为什么热、应该继续观察什么。不要编造新事实。\n\n${JSON.stringify(
            {
              title: event.title,
              category: event.category,
              summary: event.summary,
              whyItMatters: event.whyItMatters,
              hotScore: event.hotScore,
              selectedScore: event.selectedScore,
              confidence: event.confidence,
              sources: event.sources.map((source) => `${source.name}/${source.tier}/${source.platform}`),
              relatedItems: event.relatedItems.map((item) => item.title)
            },
            null,
            2
          )}`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || fallbackSummary(event);
}

function fallbackSummary(event) {
  return `${event.title}：${event.summary} 当前热度分 ${event.hotScore}，精选分 ${event.selectedScore}，可信度 ${event.confidence}。继续观察跨平台扩散、官方确认和后续开发者反馈。`;
}

app.listen(port, () => {
  console.log(`AI Signal Cockpit API listening on http://localhost:${port}`);
});
