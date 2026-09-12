const STREAMER_ID = "gkarnfud2"; // TODO: 테스트 끝나면 "insome0319"로 되돌리기

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  try {
    const params = new URLSearchParams({
      bid: STREAMER_ID,
      type: "live",
      pwd: "",
      player_type: "html5",
      stream_type: "common",
      mode: "landing",
      from_api: "0",
    });

    const url = `https://live.sooplive.co.kr/afreeca/player_live_api.php?bjid=${encodeURIComponent(STREAMER_ID)}`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await r.json();
    const channel = (data && data.CHANNEL) || {};

    const host = channel.CHDOMAIN || channel.CHIP || "";
    const port = Number(channel.CHPT || 0) + 1;

    if (!host || !channel.CHATNO || !channel.FTK) {
      res.status(200).json({ ok: false, reason: "방송 중이 아니거나 채팅 정보를 가져오지 못했습니다." });
      return;
    }

    res.status(200).json({
      ok: true,
      host,
      port,
      bjid: channel.BJID || STREAMER_ID,
      chatNo: channel.CHATNO,
      token: channel.FTK,
      bps: channel.BPS || "",
      geoCc: channel.geo_cc || "",
      geoRc: channel.geo_rc || "",
      acceptLanguage: channel.acpt_lang || "",
      serviceLanguage: channel.svc_lang || "",
    });
  } catch {
    res.status(200).json({ ok: false, reason: "요청 실패" });
  }
}
