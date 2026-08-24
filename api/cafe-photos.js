export default async function handler(req, res) {
  const clubId = "31054486";
  const menuId = "27"; // 🎁 팬아트 게시판

  res.setHeader("Content-Type", "application/json");

  let results = [];
  try {
    const url =
      `https://apis.naver.com/cafe-web/cafe-boardlist-api/v1/cafes/${clubId}/menus/${menuId}/articles` +
      `?page=1&perPage=20&viewType=L`;
    const r = await fetch(url, { headers: { Referer: `https://cafe.naver.com/f-e/cafes/${clubId}/menus/${menuId}?viewType=L` } });
    const data = await r.json();
    const articleList = data?.result?.articleList || [];

    results = articleList
      .filter((entry) => entry.type === "ARTICLE" && entry.item)
      .map((entry) => ({
        title: entry.item.subject,
        writer: entry.item.writerInfo && entry.item.writerInfo.nickName,
        url: `https://cafe.naver.com/ddarin/${entry.item.articleId}`,
        image: entry.item.representImage || "",
        published: entry.item.writeDateTimestamp || null,
      }))
      .filter((item) => item.image);
  } catch {
    // results가 비어있는 채로 반환
  }

  res.status(200).json(results);
}
