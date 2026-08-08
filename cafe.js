export default async function handler(req, res) {
  const clubId = "31054486";
  const menuId = "19"; // 따카오톡 게시판
  const targetDate = String(req.query.date || "").replace(/-/g, ""); // "20260808"

  const matches = [];

  if (targetDate) {
    for (let page = 1; page <= 5; page++) {
      const url =
        `https://apis.naver.com/cafe-web/cafe2/ArticleListV2dot1.json` +
        `?search.clubid=${clubId}&search.menuid=${menuId}&search.boardtype=L&search.page=${page}&search.perPage=20`;

      const r = await fetch(url, {
        headers: { Referer: "https://cafe.naver.com/ddarin" },
      });
      const data = await r.json();
      const list = data?.message?.result?.articleList || [];
      if (!list.length) break;

      let pastTarget = false;
      for (const item of list) {
        const d = new Date(item.writeDateTimestamp)
          .toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })
          .replace(/-/g, "");
        if (d === targetDate) {
          matches.push({ title: item.subject, url: `https://cafe.naver.com/ddarin/${item.articleId}` });
        }
        if (d < targetDate) pastTarget = true;
      }

      if (pastTarget || matches.length) break;
    }
  }

  res.setHeader("Content-Type", "application/json");
  res.status(200).json(matches);
}
