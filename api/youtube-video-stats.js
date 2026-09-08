const API_KEY = process.env.YOUTUBE_API_KEY;

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  const videoId = String(req.query.id || "");
  if (!videoId) {
    res.status(400).json({ likeCount: 0, commentCount: 0 });
    return;
  }

  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${API_KEY}`;
    const r = await fetch(url);
    const data = await r.json();
    const stats = (data.items && data.items[0] && data.items[0].statistics) || {};
    res.status(200).json({
      likeCount: Number(stats.likeCount) || 0,
      commentCount: Number(stats.commentCount) || 0,
    });
  } catch {
    res.status(200).json({ likeCount: 0, commentCount: 0 });
  }
}
