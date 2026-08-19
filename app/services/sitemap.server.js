export function generateSitemapUrls({ storeDomain, products, manualUrls = [] }) {
  const base = `https://${storeDomain}`;
  const productUrls = products.map((product) => `${base}/products/${product.handle}`);
  const staticUrls = [base, `${base}/collections/all`, `${base}/pages/contact`];

  const unique = new Set([
    ...staticUrls,
    ...productUrls,
    ...manualUrls.map((url) => String(url || "").trim()).filter(Boolean),
  ]);

  return Array.from(unique);
}
