// 따린(DDARINEE)의 유튜브 채널 두 개.
// UC5YFkTsmwnAm__Cvt66BRhA = "@DDARINEE"/"@세이브따일" (세이브파일 : 따린, 롱폼)
// UCuROXT7djegOJSyVp1lhx-w = 따린 DDARIN (쇼츠)
const CHANNEL_IDS = ["UC5YFkTsmwnAm__Cvt66BRhA", "UCuROXT7djegOJSyVp1lhx-w"];
const API_KEY = process.env.YOUTUBE_API_KEY;

// UTC 타임스탬프를 KST(UTC+9) 기준 날짜 문자열(YYYY-MM-DD)로 변환
function toKstDateStr(isoString) {
  const d = new Date(isoString);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  const targetDate = String(req.query.date || "");
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
        if (toKstDateStr(s.publishedAt) !== targetDate) continue;

        results.push({
          title: s.title,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnail:
            (s.thumbnails && (s.thumbnails.medium || s.thumbnails.default || {}).url) ||
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        });
      }
    }
  } catch {
    // results가 비어있는 채로 반환
  }

  res.status(200).json(results);
}
