export default async function handler(req, res) {
  const targetDate = String(req.query.date || ""); // "2026-08-08"
  const matches = [];
  const yearStart = targetDate.slice(0, 4) + "-01-01"; // 올해 1월 1일까지만 검색
  const BATCH_SIZE = 6;
  const MAX_PAGES = 50;

  const fetchPage = async (page) => {
    const url =
      `https://api-channel.sooplive.com/v1.1/channel/insome0319/board` +
      `?perPage=30&startDate=&endDate=&field=title,contents,user_nick,user_id,hashtags` +
      `&keyword=&type=all&orderBy=reg_date&page=${page}&bbsNo=81075151`;
    const r = await fetch(url, {
      headers: {
        Referer: "https://www.sooplive.com/",
        Origin: "https://www.sooplive.com",
        Accept: "application/json, text/plain, */*",
      },
    });
    const data = await r.json();
    const pinned = page === 1 ? data?.noticeData || [] : [];
    return [...pinned, ...(data?.contents || [])];
  };

  if (targetDate) {
    outer: for (let start = 1; start <= MAX_PAGES; start += BATCH_SIZE) {
      const pages = Array.from({ length: BATCH_SIZE }, (_, i) => start + i).filter((p) => p <= MAX_PAGES);
      const results = await Promise.all(pages.map(fetchPage));

      for (const list of results) {
        if (!list.length) break outer;

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
          if (d < yearStart) break outer;
        }
      }

      if (matches.length) break;
    }
  }

  res.setHeader("Content-Type", "application/json");
  res.status(200).json(matches);
}
