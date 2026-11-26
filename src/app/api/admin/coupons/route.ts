import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchPushForCoupon, type PushResult } from "@/lib/push/notify";
import { convertAffiliateUrl } from "@/lib/affiliate/converter";
import { sendWhatsAppDealNotification } from "@/lib/whatsapp/send";

interface CreateCouponBody {
  store_id?: string;
  title?: string;
  description?: string | null;
  code?: string | null;
  discount_label?: string | null;
  max_price_cents?: number | null;
  affiliate_url?: string;
  is_active?: boolean;
  notify?: boolean;
}

interface UpdateCouponBody {
  id?: string;
  is_active?: boolean;
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Acesso restrito ao administrador" }, { status: 401 });
  }

  let body: CreateCouponBody;
  try {
    body = (await request.json()) as CreateCouponBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const {
    store_id,
    title,
    description,
    code,
    discount_label,
    max_price_cents,
    affiliate_url,
    is_active = true,
    notify = false,
  } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Título é obrigatório" }, { status: 400 });
  }
  if (!store_id?.trim()) {
    return NextResponse.json({ error: "Loja é obrigatória" }, { status: 400 });
  }
  if (!affiliate_url?.trim()) {
    return NextResponse.json({ error: "URL de afiliado é obrigatória" }, { status: 400 });
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

  // 1. Busca a loja para converter a URL com a tag correta
  const { data: store } = await supabase
    .from("stores")
    .select("id, name, slug")
    .eq("id", store_id.trim())
    .single();

  const finalAffiliateUrl = convertAffiliateUrl(affiliate_url.trim(), store?.slug);

  const { data: coupon, error: insertError } = await supabase
    .from("coupons")
    .insert({
      store_id: store_id.trim(),
      title: title.trim(),
      description: description?.trim() || null,
      code: code?.trim() || null,
      discount_label: discount_label?.trim() || null,
      max_price_cents: typeof max_price_cents === "number" ? max_price_cents : null,
      affiliate_url: finalAffiliateUrl,
      is_active: Boolean(is_active),
    })
    .select("*, stores(id, name, slug)")
    .single();

  if (insertError || !coupon) {
    return NextResponse.json(
      { error: insertError?.message || "Erro ao salvar cupom" },
      { status: 500 }
    );
  }

  let pushResult: PushResult | null = null;
  let pushError: string | null = null;
  let whatsappResult = null;

  if (notify && coupon.is_active) {
    // Disparo 1: Web Push no navegador / celular dos usuários do app
    try {
      pushResult = await dispatchPushForCoupon(coupon.id);
    } catch (pErr) {
      pushError = pErr instanceof Error ? pErr.message : "Erro ao disparar push";
    }

    // Disparo 2: Grupo de WhatsApp
    try {
      whatsappResult = await sendWhatsAppDealNotification({
        title: coupon.title,
        storeName: store?.name || null,
        code: coupon.code,
        discountLabel: coupon.discount_label,
        maxPriceCents: coupon.max_price_cents,
        affiliateUrl: coupon.affiliate_url,
      });
    } catch (wErr) {
      console.error("[WhatsApp] Erro ao enviar:", wErr);
    }
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

export async function PATCH(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Acesso restrito ao administrador" }, { status: 401 });
  }

  let body: UpdateCouponBody;
  try {
    body = (await request.json()) as UpdateCouponBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { id, is_active } = body;
  if (!id || typeof is_active !== "boolean") {
    return NextResponse.json({ error: "Parâmetros 'id' e 'is_active' obrigatórios" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: coupon, error } = await supabase
    .from("coupons")
    .update({ is_active })
    .eq("id", id)
    .select("*, stores(id, name, slug)")
    .single();

  if (error || !coupon) {
    return NextResponse.json({ error: error?.message || "Erro ao atualizar status" }, { status: 500 });
  }

  return NextResponse.json({ success: true, coupon });
}

export async function DELETE(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Acesso restrito ao administrador" }, { status: 401 });
  }

  const url = new URL(request.url);
  let id = url.searchParams.get("id");

  if (!id) {
    try {
      const body = (await request.json()) as { id?: string };
      id = body?.id || null;
    } catch {
      // ignore
    }
  }

  if (!id) {
    return NextResponse.json({ error: "ID do cupom obrigatório" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("coupons").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id });
}
