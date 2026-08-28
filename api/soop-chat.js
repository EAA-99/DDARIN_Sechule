const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function kvCommand(cmd) {
  const res = await fetch(KV_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
  });
  return res.json();
}

function todayKeySeoul() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

async function getItems(date) {
  const { result } = await kvCommand(["GET", `soop_chat:${date}`]);
  if (!result) return [];
  try {
    const parsed = JSON.parse(result);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET") {
    const date = String(req.query.date || todayKeySeoul());
    const items = await getItems(date);
    res.status(200).json({ date, items });
    return;
  }

  if (req.method === "POST") {
    const { key, message, time } = req.body || {};
    if (key !== process.env.SOOP_CHAT_INGEST_KEY) {
      res.status(401).json({ success: false });
      return;
    }

    const text = String(message || "").trim();
    if (!text) {
      res.status(400).json({ success: false });
      return;
    }

    const date = todayKeySeoul();
    const items = await getItems(date);

    if (items.some((it) => it.message === text && it.time === time)) {
      res.status(200).json({ success: true, deduped: true, count: items.length });
      return;
    }

    items.push({ time: time || new Date().toISOString(), message: text });
    await kvCommand(["SET", `soop_chat:${date}`, JSON.stringify(items)]);
    res.status(200).json({ success: true, count: items.length });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
