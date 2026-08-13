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

async function getItems() {
  const { result } = await kvCommand(["GET", "shared_memo"]);
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
    res.status(200).json({ items: await getItems() });
    return;
  }

  if (req.method === "POST") {
    const { username, password, action, text, id, date } = req.body || {};
    if (username !== process.env.EDIT_USERNAME || password !== process.env.EDIT_PASSWORD) {
      res.status(401).json({ success: false });
      return;
    }

    let items = await getItems();
    if (action === "delete") {
      items = items.filter((it) => it.id !== id);
    } else if (action === "edit") {
      items = items.map((it) => (it.id === id ? { ...it, text: text || "", date: date || it.date || "" } : it));
    } else {
      items.unshift({ id: Date.now(), text: text || "", date: date || "" });
    }

    await kvCommand(["SET", "shared_memo", JSON.stringify(items)]);
    res.status(200).json({ success: true, items });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
