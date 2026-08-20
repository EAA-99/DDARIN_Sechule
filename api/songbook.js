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

async function getState() {
  const { result } = await kvCommand(["GET", "songbook_local"]);
  if (!result) return { overrides: {}, deletions: [] };
  try {
    const parsed = JSON.parse(result);
    return {
      overrides: parsed && typeof parsed.overrides === "object" ? parsed.overrides : {},
      deletions: Array.isArray(parsed && parsed.deletions) ? parsed.deletions : [],
    };
  } catch {
    return { overrides: {}, deletions: [] };
  }
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET") {
    res.status(200).json(await getState());
    return;
  }

  if (req.method === "POST") {
    const { username, password, overrides, deletions } = req.body || {};
    if (username !== process.env.EDIT_USERNAME || password !== process.env.EDIT_PASSWORD) {
      res.status(401).json({ success: false });
      return;
    }

    const state = {
      overrides: overrides && typeof overrides === "object" ? overrides : {},
      deletions: Array.isArray(deletions) ? deletions : [],
    };

    await kvCommand(["SET", "songbook_local", JSON.stringify(state)]);
    res.status(200).json({ success: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
