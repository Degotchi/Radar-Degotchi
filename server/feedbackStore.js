import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export async function saveFeedback(input) {
  const feedback = normalizeFeedback(input);
  const items = await readFeedbackItems();
  items.unshift(feedback);
  await writeFeedbackItems(items.slice(0, 500));
  return feedback;
}

export async function listFeedback({ take = 100 } = {}) {
  const items = await readFeedbackItems();
  return items.slice(0, Math.min(500, Math.max(1, Number(take) || 100)));
}

function normalizeFeedback(input = {}) {
  const title = String(input.title ?? "").trim();
  const content = String(input.content ?? "").trim();
  const email = String(input.email ?? "").trim();

  if (!title) throw new Error("feedback_title_required");
  if (!content) throw new Error("feedback_content_required");
  if (title.length > 120) throw new Error("feedback_title_too_long");
  if (content.length > 2400) throw new Error("feedback_content_too_long");
  if (email.length > 160) throw new Error("feedback_email_too_long");

  return {
    id: randomUUID(),
    title,
    content,
    email: email || "",
    status: "new",
    createdAt: new Date().toISOString(),
    source: {
      userAgent: String(input.userAgent ?? "").slice(0, 240),
      referer: String(input.referer ?? "").slice(0, 320)
    }
  };
}

async function readFeedbackItems() {
  try {
    const text = await readFile(feedbackStorePath(), "utf8");
    const data = JSON.parse(text);
    return Array.isArray(data.items) ? data.items : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeFeedbackItems(items) {
  const storePath = feedbackStorePath();
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify({ items }, null, 2));
}

function feedbackStorePath() {
  return process.env.FEEDBACK_STORE_PATH || join(process.cwd(), ".cache", "feedback.json");
}
