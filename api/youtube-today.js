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
      const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const xml = await r.text();

      const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
      let m;
      while ((m = entryRe.exec(xml))) {
        const entry = m[1];
        const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(entry);
        const linkMatch = /<link rel="alternate" href="([^"]+)"/.exec(entry);
        const publishedMatch = /<published>([^<]+)<\/published>/.exec(entry);
        if (!titleMatch || !linkMatch || !publishedMatch) continue;

        if (toKstDateStr(publishedMatch[1]) !== targetDate) continue;

        results.push({
          title: decodeXmlEntities(titleMatch[1]),
          url: linkMatch[1],
        });
      }
    }
  } catch {
    // results가 비어있는 채로 반환
  }

  res.status(200).json(results);
}
