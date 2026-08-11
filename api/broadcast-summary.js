export default async function handler(req, res) {
  const date = String(req.query.date || "");
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

  if (date !== today) {
    res.status(200).json({ available: false, reason: "not_today" });
    return;
  }

  const soopHeaders = {
    Accept: "application/json, text/plain, */*",
    Origin: "https://www.sooplive.com",
    Referer: "https://www.sooplive.com/",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  try {
    const stationRes = await fetch("https://chapi.sooplive.com/api/insome0319/station", { headers: soopHeaders });
    const station = await stationRes.json();
    const broadNo = station?.broad?.broad_no;

    if (!broadNo) {
      res.status(200).json({ available: false, reason: "offline" });
      return;
    }

    const summaryRes = await fetch(`https://soop-ai-api.sooplive.com/v1.0/broad-summary/kr/${broadNo}`, {
      headers: soopHeaders,
    });
    if (!summaryRes.ok) {
      res.status(200).json({ available: false, reason: "no_summary" });
      return;
    }

    const summary = await summaryRes.json();
    res.status(200).json({ available: true, summary: summary.broadSummary || "" });
  } catch {
    res.status(200).json({ available: false, reason: "error" });
  }
}
