// 따린(DDARINEE)의 유튜브 채널 두 개.
// UC5YFkTsmwnAm__Cvt66BRhA = "@DDARINEE"/"@세이브따일" (세이브파일 : 따린, 롱폼)
// UCuROXT7djegOJSyVp1lhx-w = 따린 DDARIN (쇼츠)
const CHANNEL_IDS = ["UC5YFkTsmwnAm__Cvt66BRhA", "UCuROXT7djegOJSyVp1lhx-w"];
const API_KEY = process.env.YOUTUBE_API_KEY;

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  const results = [];
  try {
    for (const channelId of CHANNEL_IDS) {
      const uploadsPlaylistId = "UU" + channelId.slice(2);
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
          channelTitle: s.channelTitle || "DDARIN",
          thumbnail:
            (s.thumbnails && (s.thumbnails.medium || s.thumbnails.default || {}).url) ||
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          likeCount: 0,
          commentCount: 0,
        });
      }
    }

    if (results.length) {
      const statsUrl =
        `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${results.map((r) => r.id).join(",")}&key=${API_KEY}`;
      const statsRes = await fetch(statsUrl);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        const statsById = {};
        (statsData.items || []).forEach((item) => {
          statsById[item.id] = item.statistics || {};
        });
        results.forEach((r) => {
          const stats = statsById[r.id];
          if (stats) {
            r.likeCount = Number(stats.likeCount) || 0;
            r.commentCount = Number(stats.commentCount) || 0;
          }
        });
      }
    }
  } catch {
    // results가 비어있는 채로 반환
  }

  results.sort((a, b) => new Date(b.published) - new Date(a.published));
  res.status(200).json(results);
}
