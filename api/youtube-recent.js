// 따린(DDARINEE)의 유튜브 채널 두 개.
// UC5YFkTsmwnAm__Cvt66BRhA = "@DDARINEE"/"@세이브따일" (세이브따린 : 따린, 롱폼)
// UCuROXT7djegOJSyVp1lhx-w = 따린 DDARIN (쇼츠)
const CHANNELS = [
  { id: "UC5YFkTsmwnAm__Cvt66BRhA", group: "longform", label: "세이브따린" },
  { id: "UCuROXT7djegOJSyVp1lhx-w", group: "shorts", label: "따린" },
];
const API_KEY = process.env.YOUTUBE_API_KEY;

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  const results = [];
  try {
    for (const channel of CHANNELS) {
      const uploadsPlaylistId = "UU" + channel.id.slice(2);
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=15&key=${API_KEY}`;
      const r = await fetch(url);
      if (!r.ok) continue;
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
          thumbnailLarge:
            (s.thumbnails && (s.thumbnails.high || s.thumbnails.standard || {}).url) ||
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          channelId: channel.id,
          group: channel.group,
          channelLabel: channel.label,
          isShorts: channel.group === "shorts",
        });
      }
    }
  } catch {
    // results가 비어있는 채로 반환
  }

  results.sort((a, b) => new Date(b.published) - new Date(a.published));
  res.status(200).json(results);
}
