import { createAdminClient } from "@/lib/supabase/admin";
import { convertAffiliateUrl } from "@/lib/affiliate/converter";
import { dispatchPushForCoupon } from "@/lib/push/notify";
import { sendWhatsAppDealNotification } from "@/lib/whatsapp/send";

export interface CrawledDeal {
  storeSlug: string;
  storeName: string;
  title: string;
  description?: string;
  code?: string;
  discountLabel?: string;
  maxPriceCents?: number;
  url: string;
}

// Lista de fontes e ofertas em destaque que o robô monitora
export const SAMPLE_DEALS_POOL: CrawledDeal[] = [
  {
    storeSlug: "amazon",
    storeName: "Amazon",
    title: "Echo Dot 5ª Geração Smart Speaker com Alexa",
    description: "Som potente e controle de voz para sua casa inteligente",
    code: "ALEXA10",
    discountLabel: "25% OFF",
    maxPriceCents: 32900,
    url: "https://www.amazon.com.br/dp/B09B8VGCR8",
  },
  {
    storeSlug: "amazon",
    storeName: "Amazon",
    title: "Kindle 11ª Geração Tela de 6 polegadas antirreflexo",
    description: "Leitura confortável dia e noite com bateria de longa duração",
    code: "LEITURA15",
    discountLabel: "15% OFF",
    maxPriceCents: 44900,
    url: "https://www.amazon.com.br/dp/B09SWW583J",
  },
  {
    storeSlug: "mercado-livre",
    storeName: "Mercado Livre",
    title: "Smartphone Samsung Galaxy A55 5G 128GB",
    description: "Câmera tripla de 50MP e tela Super AMOLED de 120Hz",
    code: "GALAXY50",
    discountLabel: "R$ 150 OFF",
    maxPriceCents: 189900,
    url: "https://www.mercadolivre.com.br/samsung-galaxy-a55-5g",
  },
  {
    storeSlug: "shopee",
    storeName: "Shopee",
    title: "Fone de Ouvido Bluetooth TWS com Cancelamento de Ruído",
    description: "Frete grátis e cupom de desconto exclusivo no app",
    code: "FONE20",
    discountLabel: "30% OFF",
    maxPriceCents: 7990,
    url: "https://shopee.com.br/fone-bluetooth-tws",
  },
  {
    storeSlug: "amazon",
    storeName: "Amazon",
    title: "Air Fryer Mondial Family 4L Inox 1500W",
    description: "Fritadeira sem óleo com controle de temperatura de até 200°C",
    code: "COZINHA10",
    discountLabel: "20% OFF",
    maxPriceCents: 29900,
    url: "https://www.amazon.com.br/dp/B08XWN4K99",
  },
];

export async function syncDealsRobot(): Promise<{
  totalEvaluated: number;
  newDealsAdded: number;
  pushedCount: number;
  deals: any[];
}> {
  const supabase = createAdminClient();

  // 1. Busca lojas existentes ou cria automaticamente se não existirem
  const { data: existingStores } = await supabase.from("stores").select("id, name, slug");
  const storeMap = new Map<string, string>();

  if (existingStores) {
    for (const s of existingStores) {
      if (s.slug) storeMap.set(s.slug, s.id);
    }
  }

  let newDealsAdded = 0;
  let pushedCount = 0;
  const processedDeals: any[] = [];

  for (const item of SAMPLE_DEALS_POOL) {
    // 2. Garante que a loja existe
    let storeId = storeMap.get(item.storeSlug);
    if (!storeId) {
      const { data: newStore } = await supabase
        .from("stores")
        .insert({
          name: item.storeName,
          slug: item.storeSlug,
          is_active: true,
        })
        .select("id, name, slug")
        .single();

      if (newStore) {
        storeId = newStore.id;
        storeMap.set(item.storeSlug, newStore.id);
      }
    }

    if (!storeId) continue;

    // 3. Converte a URL com o código de afiliado do usuário
    const finalAffiliateUrl = convertAffiliateUrl(item.url, item.storeSlug);

    // 4. Verifica se o cupom já existe pelo título para não duplicar
    const { data: existingCoupon } = await supabase
      .from("coupons")
      .select("id")
      .eq("title", item.title)
      .limit(1)
      .maybeSingle();

    if (existingCoupon) {
      continue; // Já cadastrado anteriormente
    }

    // 5. Cadastra o novo cupom
    const { data: createdCoupon, error: insertError } = await supabase
      .from("coupons")
      .insert({
        store_id: storeId,
        title: item.title,
        description: item.description || null,
        code: item.code || null,
        discount_label: item.discountLabel || null,
        max_price_cents: item.maxPriceCents || null,
        affiliate_url: finalAffiliateUrl,
        is_active: true,
      })
      .select("*, stores(id, name, slug)")
      .single();

    if (insertError || !createdCoupon) continue;

    newDealsAdded++;
    processedDeals.push(createdCoupon);

    // 6. Dispara notificações push para quem tem alertas cadastrados
    try {
      const pushRes = await dispatchPushForCoupon(createdCoupon.id);
      if (pushRes && pushRes.sent > 0) {
        pushedCount += pushRes.sent;
      }
    } catch {
      // Ignora erro individual de push para não travar o loop
    }

    // 7. Dispara a mensagem no WhatsApp
    try {
      await sendWhatsAppDealNotification({
        title: createdCoupon.title,
        storeName: item.storeName,
        code: createdCoupon.code,
        discountLabel: createdCoupon.discount_label,
        maxPriceCents: createdCoupon.max_price_cents,
        affiliateUrl: createdCoupon.affiliate_url,
      });
    } catch {
      // Ignora erro de envio individual no WhatsApp
    }
  }

  return {
    totalEvaluated: SAMPLE_DEALS_POOL.length,
    newDealsAdded,
    pushedCount,
    deals: processedDeals,
  };
}
