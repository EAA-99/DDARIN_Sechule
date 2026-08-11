export default async function handler(req, res) {
  const targetDate = String(req.query.date || ""); // "2026-08-08"
  const matches = [];
  const yearStart = targetDate.slice(0, 4) + "-01-01"; // 올해 1월 1일까지만 검색

  if (targetDate) {
    for (let page = 1; page <= 30; page++) {
      const url =
        `https://api-channel.sooplive.com/v1.1/channel/insome0319/board` +
        `?perPage=50&startDate=&endDate=&field=title,contents,user_nick,user_id,hashtags` +
        `&keyword=&type=all&orderBy=reg_date&page=${page}&bbsNo=81075151`;

      const r = await fetch(url, { headers: { Referer: "https://www.sooplive.com/" } });
      const data = await r.json();
      const pinned = page === 1 ? data?.noticeData || [] : [];
      const list = [...pinned, ...(data?.contents || [])];
      if (!list.length) break;

      let stop = false;
      for (const item of list) {
        const d = (item.regDate || "").slice(0, 10);
        if (d === targetDate) {
          const rawContent = item.content?.textContent || "";
          matches.push({
            title: item.titleName,
            content: rawContent.replace(/<br\s*\/?>/gi, "\n"),
            url: `https://www.sooplive.com/station/insome0319/post/${item.titleNo}`,
          });
        }
        if (d < yearStart) stop = true;
      }

      if (stop || matches.length) break;
    }
  }

  res.setHeader("Content-Type", "application/json");
  res.status(200).json(matches);
}
