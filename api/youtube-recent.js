// 따린(DDARINEE) 유튜브 채널. "@DDARINEE"와 "@세이브따일" 두 핸들 모두
// 같은 채널(UC5YFkTsmwnAm__Cvt66BRhA)로 연결되어 있어 채널 ID는 하나만 사용.
const CHANNEL_IDS = ["UC5YFkTsmwnAm__Cvt66BRhA"];
const API_KEY = process.env.YOUTUBE_API_KEY;

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  const results = [];
  const debug = [];
  try {
    for (const channelId of CHANNEL_IDS) {
      const uploadsPlaylistId = "UU" + channelId.slice(2);
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=15&key=${API_KEY}`;
      const r = await fetch(url);
      if (!r.ok) {
        debug.push({ hasKey: Boolean(API_KEY), status: r.status, body: await r.text() });
        continue;
      }
      const data = await r.json();

      for (const item of data.items || []) {
        const s = item.snippet;
        const videoId = s && s.resourceId && s.resourceId.videoId;
        if (!videoId || !s.publishedAt) continue;

        results.push({
          id: videoId,
          title: s.title,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          published: s.publishedAt,
          thumbnail:
            (s.thumbnails && (s.thumbnails.medium || s.thumbnails.default || {}).url) ||
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        });
      }
    }
  } catch (err) {
    debug.push({ caught: String(err) });
  }

  if (req.query.checkVideo) {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${req.query.checkVideo}&key=${API_KEY}`;
    const r = await fetch(url);
    const data = await r.json();
    res.status(200).json(data);
    return;
  }

  results.sort((a, b) => new Date(b.published) - new Date(a.published));
  if (req.query.debug) {
    res.status(200).json({ results, debug });
    return;
  }
  res.status(200).json(results);
}
