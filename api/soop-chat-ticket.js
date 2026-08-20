// SOOP(구 아프리카TV) 채팅은 공식 문서화된 API가 없습니다.
// 아래는 예전 아프리카TV의 player_live_api.php 방식을 기반으로 한 추정 구현이라,
// 실제 방송에서 응답 구조(raw)를 확인하며 필드명을 맞춰야 할 수 있습니다.
const BJID = "insome0319";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  try {
    const body = new URLSearchParams({
      bid: BJID,
      type: "live",
      player_type: "html5",
      mode: "landing",
      pwd: "",
      stream_type: "common",
      quality: "HD",
    });

    const r = await fetch(`https://live.sooplive.com/afreeca/player_live_api.php?bjid=${BJID}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json, text/plain, */*",
        Referer: `https://play.sooplive.com/${BJID}`,
        Origin: "https://play.sooplive.com",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body,
    });

    const data = await r.json();
    const channel = data && data.CHANNEL;

    if (!channel || Number(channel.RESULT) !== 1) {
      res.status(200).json({ available: false, raw: data });
      return;
    }

    res.status(200).json({
      available: true,
      bno: channel.BNO,
      bjid: channel.BJID || BJID,
      chatNo: channel.CHATNO,
      chatDomain: channel.CHDOMAIN,
      chatPort: channel.CHPT,
      ftk: channel.FTK,
      raw: channel,
    });
  } catch (err) {
    res.status(200).json({ available: false, error: String(err) });
  }
}
