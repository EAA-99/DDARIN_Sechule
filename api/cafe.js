export default async function handler(req, res) {
  const clubId = "31054486";
  const menuId = "19"; // 따카오톡 게시판
  const targetDate = String(req.query.date || "").replace(/-/g, ""); // "20260808"

  const matches = [];
  const yearStart = targetDate.slice(0, 4) + "0101"; // 올해 1월 1일까지만 검색

  if (targetDate) {
    for (let page = 1; page <= 30; page++) {
      const url =
        `https://apis.naver.com/cafe-web/cafe2/ArticleListV2dot1.json` +
        `?search.clubid=${clubId}&search.menuid=${menuId}&search.boardtype=L&search.page=${page}&search.perPage=50`;

      const r = await fetch(url, {
        headers: { Referer: "https://cafe.naver.com/ddarin" },
      });
      const data = await r.json();
      const list = data?.message?.result?.articleList || [];
      if (!list.length) break;

      let stop = false;
      for (const item of list) {
        const d = new Date(item.writeDateTimestamp)
          .toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })
          .replace(/-/g, "");
        if (d === targetDate) {
          matches.push({ title: item.subject, url: `https://cafe.naver.com/ddarin/${item.articleId}` });
        }
        if (d < yearStart) stop = true;
      }

      if (stop || matches.length) break;
    }
  }

  res.setHeader("Content-Type", "application/json");
  res.status(200).json(matches);
}
