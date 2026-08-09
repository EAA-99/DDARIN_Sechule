export default async function handler(req, res) {
  const date = String(req.query.date || "");
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

  if (date !== today) {
    res.status(200).json({ available: false, reason: "not_today" });
    return;
  }

  try {
    const stationRes = await fetch("https://bjapi.afreecatv.com/api/insome0319/station");
    const station = await stationRes.json();
    const broadNo = station?.broad?.broad_no;

    if (!broadNo) {
      res.status(200).json({ available: false, reason: "offline" });
      return;
    }

    const summaryRes = await fetch(`https://soop-ai-api.sooplive.com/v1.0/broad-summary/kr/${broadNo}`);
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
