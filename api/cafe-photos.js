export default async function handler(req, res) {
  const clubId = "31054486";
  const menuId = "27"; // 🎁 팬아트 게시판
  const currentYear = new Date().getFullYear();
  const MAX_PAGES = 20;

  res.setHeader("Content-Type", "application/json");

  const results = [];
  try {
    outer: for (let page = 1; page <= MAX_PAGES; page++) {
      const url =
        `https://apis.naver.com/cafe-web/cafe-boardlist-api/v1/cafes/${clubId}/menus/${menuId}/articles` +
        `?page=${page}&perPage=20&viewType=L`;
      const r = await fetch(url, { headers: { Referer: `https://cafe.naver.com/f-e/cafes/${clubId}/menus/${menuId}?viewType=L` } });
      const data = await r.json();
      const articleList = data?.result?.articleList || [];
      if (!articleList.length) break;

      for (const entry of articleList) {
        if (entry.type !== "ARTICLE" || !entry.item) continue;
        const timestamp = entry.item.writeDateTimestamp;
        if (!timestamp) continue;
        if (new Date(timestamp).getFullYear() !== currentYear) break outer;

        if (!entry.item.representImage) continue;
        results.push({
          title: entry.item.subject,
          writer: entry.item.writerInfo && entry.item.writerInfo.nickName,
          url: `https://cafe.naver.com/ddarin/${entry.item.articleId}`,
          image: entry.item.representImage,
          published: timestamp,
          likeCount: entry.item.likeCount || 0,
        });
      }
    }
  } catch {
    // results가 비어있는 채로 반환
  }

  res.status(200).json(results);
}
