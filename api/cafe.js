export default async function handler(req, res) {
  const clubId = "31054486";
  const menuId = "19"; // 따카오톡 게시판
  const targetDate = String(req.query.date || "").replace(/-/g, ""); // "20260808"

  const matches = [];
  const yearStart = targetDate.slice(0, 4) + "0101"; // 올해 1월 1일까지만 검색
  const MAX_PAGES = 30;

  const fetchPage = async (page) => {
    const url =
      `https://apis.naver.com/cafe-web/cafe-boardlist-api/v1/cafes/${clubId}/menus/${menuId}/articles` +
      `?page=${page}&perPage=20&viewType=L`;
    const r = await fetch(url, {
      headers: { Referer: `https://cafe.naver.com/f-e/cafes/${clubId}/menus/${menuId}?viewType=L` },
    });
    const data = await r.json();
    return {
      list: (data?.result?.articleList || []).filter((entry) => entry.type === "ARTICLE"),
      hasMore: Boolean(data?.result?.pageInfo?.visibleNextButton),
    };
  };

  if (targetDate) {
    outer: for (let page = 1; page <= MAX_PAGES; page++) {
      const { list, hasMore } = await fetchPage(page);
      if (!list.length) break;

      for (const entry of list) {
        const item = entry.item;
        const d = new Date(item.writeDateTimestamp)
          .toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })
          .replace(/-/g, "");
        if (d === targetDate) {
          matches.push({
            title: item.subject,
            url: `https://cafe.naver.com/ddarin/${item.articleId}`,
            image: item.representImage || null,
          });
        }
        if (d < yearStart) break outer;
      }

      if (matches.length) break;
      if (!hasMore) break;
    }
  }

  res.setHeader("Content-Type", "application/json");
  res.status(200).json(matches);
}
