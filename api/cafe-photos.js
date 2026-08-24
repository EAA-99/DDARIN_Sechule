export default async function handler(req, res) {
  const clubId = "31054486";
  const menuId = "27"; // 🎁 팬아트 게시판

  res.setHeader("Content-Type", "application/json");

  let results = [];
  try {
    const url =
      `https://apis.naver.com/cafe-web/cafe2/ArticleListV2dot1.json` +
      `?search.clubid=${clubId}&search.menuid=${menuId}&search.boardtype=L&search.page=1&search.perPage=20`;
    const r = await fetch(url, { headers: { Referer: "https://cafe.naver.com/ddarin" } });
    const data = await r.json();
    const articleList = data?.message?.result?.articleList || [];

    results = articleList.map((item) => ({
      title: item.subject,
      writer: item.writerNickname,
      url: `https://cafe.naver.com/ddarin/${item.articleId}`,
    }));
  } catch {
    // results가 비어있는 채로 반환
  }

  res.status(200).json(results);
}
