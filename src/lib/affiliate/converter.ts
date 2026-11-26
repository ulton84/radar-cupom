/**
 * Conversor Inteligente de Links de Afiliado
 * Limpa parâmetros de terceiros e injeta a sua tag/código de afiliado.
 */

export function convertAffiliateUrl(originalUrl: string, storeSlug?: string): string {
  if (!originalUrl) return "";

  try {
    const urlObj = new URL(originalUrl);
    const host = urlObj.hostname.toLowerCase();

    // 1. Amazon
    const amazonTag = process.env.AMAZON_AFFILIATE_TAG || "radar0bb-20";
    if (host.includes("amazon.com") || host.includes("amzn.to") || storeSlug === "amazon") {
      // Remove tags antigas de terceiros e injeta a sua
      urlObj.searchParams.set("tag", amazonTag);
      return urlObj.toString();
    }

    // 2. Mercado Livre
    const mlTag = process.env.MERCADOLIVRE_AFFILIATE_TAG || "radarcupom";
    if (host.includes("mercadolivre.com") || host.includes("mercadolivre.com.br") || storeSlug === "mercado-livre") {
      urlObj.searchParams.set("tracking_id", mlTag);
      return urlObj.toString();
    }

    // 3. Shopee
    const shopeeTag = process.env.SHOPEE_AFFILIATE_TAG || "radarcupom";
    if (host.includes("shopee.com") || host.includes("shope.ee") || storeSlug === "shopee") {
      urlObj.searchParams.set("aff_sub", shopeeTag);
      return urlObj.toString();
    }

    // 4. Magalu (Magazine Luiza)
    const magaluTag = process.env.MAGALU_AFFILIATE_TAG || "radarcupom";
    if (host.includes("magazineluiza.com.br") || storeSlug === "magalu" || storeSlug === "magazine-luiza") {
      urlObj.searchParams.set("partner_id", magaluTag);
      return urlObj.toString();
    }

    return originalUrl;
  } catch {
    // Se a URL não for válida, retorna a original
    return originalUrl;
  }
}
