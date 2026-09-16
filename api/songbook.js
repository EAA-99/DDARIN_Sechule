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

async function getQueue() {
  const { result } = await kvCommand(["GET", "songbook_queue"]);
  if (!result) return { queue: [], times: {} };
  try {
    const parsed = JSON.parse(result);
    if (Array.isArray(parsed)) return { queue: parsed, times: {} };
    return {
      queue: Array.isArray(parsed.queue) ? parsed.queue : [],
      times: parsed.times && typeof parsed.times === "object" ? parsed.times : {},
    };
  } catch {
    return { queue: [], times: {} };
  }
}

async function getLyricsSync() {
  const { result } = await kvCommand(["GET", "songbook_lyrics_sync"]);
  if (!result) return { title: "", artist: "", lines: [], position: 0, playing: false };
  try {
    const parsed = JSON.parse(result);
    return {
      title: typeof parsed.title === "string" ? parsed.title : "",
      artist: typeof parsed.artist === "string" ? parsed.artist : "",
      lines: Array.isArray(parsed.lines) ? parsed.lines : [],
      position: Number(parsed.position) || 0,
      playing: !!parsed.playing,
    };
  } catch {
    return { title: "", artist: "", lines: [], position: 0, playing: false };
  }
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method === "GET") {
    if (req.query.resource === "queue") {
      res.status(200).json(await getQueue());
      return;
    }
    if (req.query.resource === "lyrics") {
      res.status(200).json(await getLyricsSync());
      return;
    }
    res.status(200).json(await getState());
    return;
  }

  if (req.method === "POST") {
    const { key, overrides, deletions, resource, queue, times, title, artist, lines, position, playing } = req.body || {};
    if (key !== process.env.SONGBOOK_APP_KEY) {
      res.status(401).json({ success: false });
      return;
    }

    if (resource === "queue") {
      const queueState = {
        queue: Array.isArray(queue) ? queue : [],
        times: times && typeof times === "object" ? times : {},
      };
      await kvCommand(["SET", "songbook_queue", JSON.stringify(queueState)]);
      res.status(200).json({ success: true });
      return;
    }

    if (resource === "lyrics") {
      const lyricsState = {
        title: typeof title === "string" ? title : "",
        artist: typeof artist === "string" ? artist : "",
        lines: Array.isArray(lines) ? lines : [],
        position: Number(position) || 0,
        playing: !!playing,
      };
      await kvCommand(["SET", "songbook_lyrics_sync", JSON.stringify(lyricsState)]);
      res.status(200).json({ success: true });
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
