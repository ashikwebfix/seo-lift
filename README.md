# Ecom SEO - Shopify Embedded App

Production-oriented Shopify embedded app for SEO operations across audit, product metadata, URL hygiene, robots control, sitemap generation, and AI-assisted fix actions.

## Features

- Dashboard with SEO score, pages scanned, issue counts, index coverage, last scan date, and trend summary.
- Store-wide SEO scan with prioritized findings (Critical, Warning, Info) and direct Fix links.
- SEO health scoring bands: `strong`, `steady`, `weak`.
- Product SEO management with live Shopify Admin REST product data (`/products.json`), search, pagination, row edit/save.
- Bulk meta editor with check/save actions and ideal vs hard-length status.
- Image optimizer with ALT text check and bulk-fix options for missing/generic/weak ALT tags.
- URL optimization with normalized slug suggestions and bulk apply.
- Robots.txt manager with required `/cart` and `/search` disallow validation.
- Sitemap manager with generated timestamp, URL count, manual URL add + regenerate.
- AI fix actions endpoint returning strict JSON:
  - `meta_fix`
  - `product_seo_fix`
  - `url_handle_suggestion`
  - `robots_txt_improvement`
- Clear config error states when store domain/token are missing.
- Local draft persistence for product edit rows via `localStorage`.

## Required Scopes

- `read_products`
- `write_products`
- `read_content`
- `write_content`

Set in `SCOPES` (see `.env.example`) and ensure your app config in Shopify Partners matches.

## Environment

Copy `.env.example` to `.env` and fill values.

Required SEO sync variables:

- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_ADMIN_ACCESS_TOKEN`
- `SHOPIFY_ADMIN_API_VERSION`

## Run Locally

```bash
npm install
npm run setup
npm run dev
```

Other useful commands:

```bash
npm run test
npm run typecheck
npm run build
```

## App Structure

```text
app/
  components/
    seo-ui.jsx
  mappers/
    product.mapper.js
  routes/
    app.jsx
    app._index.jsx             # Dashboard
    app.seo-audit.jsx          # Scan + prioritized issues
    app.products.jsx           # Product SEO manager
    app.bulk-meta.jsx          # Bulk meta editor
    app.image-optimizer.jsx    # Image ALT audit + bulk fix
    app.url-optimization.jsx   # URL suggestion + bulk apply
    app.robots.jsx             # robots.txt manager
    app.sitemap.jsx            # Sitemap manager
    app.api.ai.jsx             # AI fix action endpoint
  services/
    app-state.server.js
    shopify-admin.server.js
    route-context.server.js
    seo-audit.server.js
    seo-engine.server.js
    seo-workflows.server.js
    sitemap.server.js
    ai-fixes.server.js
  validators/
    seoValidators.js
  utils/
    env.server.js
    pagination.js

prisma/
  schema.prisma
  migrations/

tests/
  seo-validators.test.js
  product-mapper.test.js
  shopify-admin-errors.test.js
```

## Shopify Setup Notes

1. Create/install the app on a dev store via Shopify CLI.
2. Confirm `SCOPES` include product/content read-write scopes.
3. Ensure embedded mode is enabled (`shopify.app.toml`).
4. Provide `SHOPIFY_STORE_DOMAIN` + admin token for REST sync actions.
5. Run database migrations (`npm run setup`).

## AI Endpoint Example

`POST /app/api/ai`

```json
{
  "actionType": "meta_fix",
  "title": "Running Shoes",
  "focusKeyword": "lightweight running shoes"
}
```

Response shape:

```json
{
  "ok": true,
  "actionType": "meta_fix",
  "result": {
    "metaTitle": "...",
    "metaDescription": "...",
    "rationale": "..."
  }
}
```
