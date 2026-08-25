const GROUPS = {
  youtube: [
    { id: "PLO1Oy6ecS9SqP8ukPjrL8zEk_wWEjoJYq", label: "단체 커버곡" },
    { id: "PLO1Oy6ecS9SqcGn07NZMxUEH6bKz5UtbQ", label: "노래 영상" },
  ],
  playlist: [
    { id: "PLO1Oy6ecS9Sp8_V9ATKJIuZ1tD0muxiAu", label: "출근용" },
    { id: "PLO1Oy6ecS9SqKtqUkTyFFpaABWoMLJAcj", label: "퇴근용" },
  ],
};
const API_KEY = process.env.YOUTUBE_API_KEY;

async function fetchPlaylistItems(playlistId) {
  const items = [];
  let pageToken = "";
  do {
    const url =
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${API_KEY}` +
      (pageToken ? `&pageToken=${pageToken}` : "");
    const r = await fetch(url);
    if (!r.ok) break;
    const data = await r.json();

    for (const item of data.items || []) {
      const s = item.snippet;
      const videoId = s && s.resourceId && s.resourceId.videoId;
      if (!videoId || s.title === "Deleted video" || s.title === "Private video") continue;

      items.push({
        id: videoId,
        title: s.title,
        artist: s.videoOwnerChannelTitle || "",
        url: `https://music.youtube.com/watch?v=${videoId}`,
        thumbnail:
          (s.thumbnails && (s.thumbnails.medium || s.thumbnails.default || {}).url) ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      });
    }

    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return items;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  const group = GROUPS[req.query.group] ? req.query.group : "youtube";
  const playlists = GROUPS[group];

  const results = [];
  try {
    for (const pl of playlists) {
      const items = await fetchPlaylistItems(pl.id);
      items.forEach((item) => results.push({ ...item, source: pl.label }));
    }
  } catch {
    // results가 비어있는 채로 반환
  }

  res.status(200).json({ items: results, sources: playlists.map((p) => p.label) });
}
