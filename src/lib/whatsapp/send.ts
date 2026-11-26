export interface WhatsAppDealPayload {
  title: string;
  storeName?: string | null;
  code?: string | null;
  discountLabel?: string | null;
  maxPriceCents?: number | null;
  affiliateUrl: string;
}

export function formatWhatsAppDealMessage(deal: WhatsAppDealPayload): string {
  const parts: string[] = [
    "🔥 *OFERTA ENCONTRADA NO RADAR CUPOM!*",
    "",
    `📦 *${deal.title}*`,
  ];

  if (deal.storeName) {
    parts.push(`🏪 Loja: *${deal.storeName}*`);
  }

  if (deal.code) {
    parts.push(`🎟 Cupom: *${deal.code}*`);
  }

  if (deal.discountLabel) {
    parts.push(`🏷 Desconto: *${deal.discountLabel}*`);
  }

  if (deal.maxPriceCents != null) {
    const formattedPrice = (deal.maxPriceCents / 100).toFixed(2).replace(".", ",");
    parts.push(`💰 Por apenas: *R$ ${formattedPrice}*`);
  }

  parts.push("");
  parts.push("👇 *Acesse e aproveite antes que esgote:*");
  parts.push(`🔗 ${deal.affiliateUrl}`);
  parts.push("");
  parts.push("⚡ _Radar Cupom - Descontos verificados em tempo real_");

  return parts.join("\n");
}

export async function sendWhatsAppDealNotification(
  deal: WhatsAppDealPayload
): Promise<{ success: boolean; sentCount: number; message: string }> {
  const isEnabled = process.env.WHATSAPP_ENABLED === "true";
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiKey = process.env.WHATSAPP_API_KEY;
  const rawGroupIds = process.env.WHATSAPP_GROUP_ID;

  const textMessage = formatWhatsAppDealMessage(deal);

  // Se o envio real estiver desativado no momento, registra no log em modo simulação
  if (!isEnabled || !apiUrl || !rawGroupIds) {
    console.log(
      "[WhatsApp] Disparo em modo demonstração (ative WHATSAPP_ENABLED=true para enviar para grupos reais):\n",
      textMessage
    );
    return {
      success: true,
      sentCount: 0,
      message: "Modo demonstração (configure WHATSAPP_API_URL e WHATSAPP_GROUP_ID para envio real)",
    };
  }

  const groupIds = rawGroupIds
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);

  let sentCount = 0;

  for (const groupId of groupIds) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { apikey: apiKey, Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          number: groupId,
          chatId: groupId,
          text: textMessage,
          message: textMessage,
        }),
      });

      if (response.ok) {
        sentCount++;
      } else {
        console.warn(`[WhatsApp] Falha ao enviar para ${groupId}: HTTP ${response.status}`);
      }
    } catch (err) {
      console.error(`[WhatsApp] Erro de rede ao disparar para ${groupId}:`, err);
    }
  }

  return {
    success: sentCount > 0,
    sentCount,
    message: `${sentCount} grupo(s) de WhatsApp notificados`,
  };
}
