import {
  validateFocusKeyword,
  validateMetaDescription,
  validateMetaTitle,
  validateProductTitle,
  validateUrlHandle,
} from "../validators/seoValidators.js";

export function mapShopifyProductToSeoRow(product, productState = {}) {
  const title = String(product.title || "");
  const metaTitle = String(product.metafields_global_title_tag || "");
  const metaDescription = String(
    product.metafields_global_description_tag || "",
  );
  const handle = String(product.handle || "");
  const focusKeyword = String(productState.focusKeyword || "");

  return {
    id: String(product.id),
    title,
    focusKeyword,
    metaTitle,
    metaDescription,
    handle,
    updatedAt: product.updated_at || null,
    validation: {
      title: validateProductTitle(title),
      focusKeyword: validateFocusKeyword(focusKeyword),
      metaTitle: validateMetaTitle(metaTitle),
      metaDescription: validateMetaDescription(metaDescription),
      handle: validateUrlHandle(handle),
    },
  };
}
