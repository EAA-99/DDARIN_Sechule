export default async function handler(req, res) {
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
    res.status(200).json({ live: Boolean(station?.broad?.broad_no) });
  } catch {
    res.status(200).json({ live: false });
  }
}
