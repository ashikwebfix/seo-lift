export function parseLinkHeader(linkHeader) {
  if (!linkHeader) {
    return { nextPageInfo: "", previousPageInfo: "" };
  }

  const links = linkHeader.split(",").map((part) => part.trim());
  const result = { nextPageInfo: "", previousPageInfo: "" };

  for (const link of links) {
    const [urlPart, relPart] = link.split(";").map((value) => value.trim());
    if (!urlPart || !relPart) continue;

    const relMatch = relPart.match(/rel="(next|previous)"/);
    const hrefMatch = urlPart.match(/<(.+)>/);
    if (!relMatch || !hrefMatch) continue;

    const url = new URL(hrefMatch[1]);
    const pageInfo = url.searchParams.get("page_info") || "";

    if (relMatch[1] === "next") result.nextPageInfo = pageInfo;
    if (relMatch[1] === "previous") result.previousPageInfo = pageInfo;
  }

  return result;
}
