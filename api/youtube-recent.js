// 따린(DDARINEE) 유튜브 채널. "@DDARINEE"와 "@세이브따일" 두 핸들 모두
// 같은 채널(UC5YFkTsmwnAm__Cvt66BRhA)로 연결되어 있어 채널 ID는 하나만 사용.
const CHANNEL_IDS = ["UC5YFkTsmwnAm__Cvt66BRhA"];

function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  const results = [];
  try {
    for (const channelId of CHANNEL_IDS) {
      const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const xml = await r.text();

      const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
      let m;
      while ((m = entryRe.exec(xml))) {
        const entry = m[1];
        const idMatch = /<yt:videoId>([^<]+)<\/yt:videoId>/.exec(entry);
        const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(entry);
        const linkMatch = /<link rel="alternate" href="([^"]+)"/.exec(entry);
        const publishedMatch = /<published>([^<]+)<\/published>/.exec(entry);
        const thumbMatch = /<media:thumbnail url="([^"]+)"/.exec(entry);
        if (!idMatch || !titleMatch || !linkMatch || !publishedMatch) continue;

        results.push({
          id: idMatch[1],
          title: decodeXmlEntities(titleMatch[1]),
          url: linkMatch[1],
          published: publishedMatch[1],
          thumbnail: thumbMatch ? thumbMatch[1] : `https://i.ytimg.com/vi/${idMatch[1]}/hqdefault.jpg`,
        });
      }
    }
  } catch {
    // results가 비어있는 채로 반환
  }

  results.sort((a, b) => new Date(b.published) - new Date(a.published));
  res.status(200).json(results);
}
