const PLAYLIST_IDS = ["PLO1Oy6ecS9SqP8ukPjrL8zEk_wWEjoJYq", "PLO1Oy6ecS9SqcGn07NZMxUEH6bKz5UtbQ"];
const API_KEY = process.env.YOUTUBE_API_KEY;

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  const results = [];
  try {
    for (const playlistId of PLAYLIST_IDS) {
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

          results.push({
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
    }
  } catch {
    // results가 비어있는 채로 반환
  }

  res.status(200).json(results);
}
