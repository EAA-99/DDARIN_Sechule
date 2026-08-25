export default async function handler(req, res) {
  const clubId = "31054486";
  const menuId = "27"; // 🎁 팬아트 게시판
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);

  res.setHeader("Content-Type", "application/json");

  let items = [];
  let hasMore = false;
  try {
    const url =
      `https://apis.naver.com/cafe-web/cafe-boardlist-api/v1/cafes/${clubId}/menus/${menuId}/articles` +
      `?page=${page}&perPage=20&viewType=L`;
    const r = await fetch(url, { headers: { Referer: `https://cafe.naver.com/f-e/cafes/${clubId}/menus/${menuId}?viewType=L` } });
    const data = await r.json();
    const articleList = data?.result?.articleList || [];
    hasMore = Boolean(data?.result?.pageInfo?.visibleNextButton);

    items = articleList
      .filter((entry) => entry.type === "ARTICLE" && entry.item && entry.item.representImage)
      .map((entry) => ({
        title: entry.item.subject,
        writer: entry.item.writerInfo && entry.item.writerInfo.nickName,
        url: `https://cafe.naver.com/ddarin/${entry.item.articleId}`,
        image: entry.item.representImage,
        published: entry.item.writeDateTimestamp || null,
        likeCount: entry.item.likeCount || 0,
      }));
  } catch {
    // items가 비어있는 채로 반환
  }

  res.status(200).json({ items, hasMore });
}
