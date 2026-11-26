import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchPushForCoupon, type PushResult } from "@/lib/push/notify";
import { convertAffiliateUrl } from "@/lib/affiliate/converter";
import { sendWhatsAppDealNotification } from "@/lib/whatsapp/send";

interface WebhookCouponBody {
  store_slug?: string;
  title?: string;
  description?: string | null;
  code?: string | null;
  discount_label?: string | null;
  max_price_cents?: number | string | null;
  affiliate_url?: string;
}

export async function POST(request: Request) {
  const adminApiKey = process.env.ADMIN_API_KEY;
  const apiKeyHeader = request.headers.get("x-api-key");

  if (!adminApiKey || apiKeyHeader !== adminApiKey) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: WebhookCouponBody;
  try {
    body = (await request.json()) as WebhookCouponBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const {
    store_slug,
    title,
    description,
    code,
    discount_label,
    max_price_cents,
    affiliate_url,
  } = body;

  if (!store_slug?.trim()) {
    return NextResponse.json({ error: "'store_slug' é obrigatório" }, { status: 400 });
  }
  if (!title?.trim()) {
    return NextResponse.json({ error: "'title' é obrigatório" }, { status: 400 });
  }
  if (!affiliate_url?.trim()) {
    return NextResponse.json({ error: "'affiliate_url' é obrigatório" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro de configuração Supabase" },
      { status: 500 }
    );
  }

  // 1. Localiza a loja pelo store_slug
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, name, slug")
    .eq("slug", store_slug.trim())
    .single();

  if (storeError || !store) {
    return NextResponse.json(
      { error: `Loja com slug '${store_slug}' não encontrada` },
      { status: 404 }
    );
  }

  // Normalização de max_price_cents
  let parsedPriceCents: number | null = null;
  if (typeof max_price_cents === "number" && !isNaN(max_price_cents)) {
    parsedPriceCents = Math.round(max_price_cents);
  } else if (typeof max_price_cents === "string" && max_price_cents.trim() !== "") {
    const num = parseFloat(max_price_cents.replace(",", "."));
    if (!isNaN(num)) {
      parsedPriceCents = Math.round(num);
    }
  }

  // Injeta automaticamente o link de afiliado do usuário
  const finalAffiliateUrl = convertAffiliateUrl(affiliate_url.trim(), store.slug);

  // 2. Insere o cupom como ativo
  const { data: coupon, error: insertError } = await supabase
    .from("coupons")
    .insert({
      store_id: store.id,
      title: title.trim(),
      description: description?.trim() || null,
      code: code?.trim() || null,
      discount_label: discount_label?.trim() || null,
      max_price_cents: parsedPriceCents,
      affiliate_url: finalAffiliateUrl,
      is_active: true,
    })
    .select("*, stores(id, name, slug)")
    .single();

  if (insertError || !coupon) {
    return NextResponse.json(
      { error: insertError?.message || "Erro ao inserir cupom" },
      { status: 500 }
    );
  }

  // 3. Dispara automaticamente os alertas push correspondentes
  let pushResult: PushResult | null = null;
  let pushError: string | null = null;
  let whatsappResult = null;

  try {
    pushResult = await dispatchPushForCoupon(coupon.id);
  } catch (pErr) {
    pushError = pErr instanceof Error ? pErr.message : "Erro ao disparar push";
  }

  // 4. Dispara a mensagem formatada para os grupos de WhatsApp
  try {
    whatsappResult = await sendWhatsAppDealNotification({
      title: coupon.title,
      storeName: store.name,
      code: coupon.code,
      discountLabel: coupon.discount_label,
      maxPriceCents: coupon.max_price_cents,
      affiliateUrl: coupon.affiliate_url,
    });
  } catch (wErr) {
    console.error("[WhatsApp] Erro ao disparar mensagem:", wErr);
  }

  return NextResponse.json(
    {
      success: true,
      coupon,
      push: pushResult,
      pushError,
      whatsapp: whatsappResult,
    },
    { status: 201 }
  );
}
