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

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET") {
    const { result } = await kvCommand(["GET", "shared_memo"]);
    res.status(200).json({ text: result || "" });
    return;
  }

  if (req.method === "POST") {
    const { username, password, text } = req.body || {};
    if (username !== process.env.EDIT_USERNAME || password !== process.env.EDIT_PASSWORD) {
      res.status(401).json({ success: false });
      return;
    }
    await kvCommand(["SET", "shared_memo", text || ""]);
    res.status(200).json({ success: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
