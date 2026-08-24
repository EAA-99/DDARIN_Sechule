export default async function handler(req, res) {
  const imageUrl = String(req.query.url || "");
  if (!/^https:\/\/cafe[a-z0-9]*thumb-phinf\.pstatic\.net\//.test(imageUrl)) {
    res.status(400).end();
    return;
  }

  try {
    const r = await fetch(imageUrl);
    if (!r.ok) {
      res.status(502).end();
      return;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", r.headers.get("content-type") || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.status(200).send(buf);
  } catch {
    res.status(502).end();
  }
}
