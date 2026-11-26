import { createClient } from "@supabase/supabase-js";
import { sendNotification, setVapidDetails } from "web-push";

export interface PushResult {
  matched_users: number;
  sent: number;
  failed: number;
}

export async function dispatchPushForCoupon(couponId: string): Promise<PushResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY !== "your-service-role-key"
      ? process.env.SUPABASE_SERVICE_ROLE_KEY
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

  if (!url || !serviceKey || !vapidPublic || !vapidPrivate) {
    throw new Error("Configuração do servidor incompleta (Supabase ou VAPID)");
  }

  setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:contato@radarcupom.com",
    vapidPublic,
    vapidPrivate
  );

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: coupon, error: couponError } = await supabase
    .from("coupons")
    .select("id, store_id, title, description, max_price_cents, affiliate_url, is_active, stores(name)")
    .eq("id", couponId)
    .single();

  if (couponError || !coupon) {
    throw new Error("Cupom não encontrado");
  }

  const { data: alerts, error: alertsError } = await supabase
    .from("user_alerts")
    .select("user_id, keyword, store_id, max_price_cents")
    .eq("is_active", true);

  if (alertsError) {
    throw new Error(alertsError.message);
  }

  const haystack = `${coupon.title} ${coupon.description ?? ""}`.toLowerCase();
  const userIds = [
    ...new Set(
      (alerts ?? [])
        .filter((a) => {
          if (!haystack.includes(a.keyword.toLowerCase())) return false;
          if (a.store_id && a.store_id !== coupon.store_id) return false;
          if (a.max_price_cents != null) {
            // Cupom sem preço informado não casa com alerta que exige teto.
            if (coupon.max_price_cents == null || coupon.max_price_cents > a.max_price_cents) {
              return false;
            }
          }
          return true;
        })
        .map((a) => a.user_id as string)
    ),
  ];

  if (userIds.length === 0) {
    return { matched_users: 0, sent: 0, failed: 0 };
  }

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (subsError) {
    throw new Error(subsError.message);
  }

  const storeData = coupon.stores as { name: string } | { name: string }[] | null;
  const storeLabel = Array.isArray(storeData) ? storeData[0]?.name : storeData?.name;
  const payload = JSON.stringify({
    title: storeLabel ? `Novo cupom: ${storeLabel}` : "Novo cupom no Radar Cupom",
    body: coupon.title,
    icon: "/icon.svg",
    url: coupon.affiliate_url,
  });

  let sent = 0;
  let failed = 0;
  const expired: string[] = [];

  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (err) {
        failed++;
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(s.id);
      }
    })
  );

  if (expired.length) {
    await supabase.from("push_subscriptions").delete().in("id", expired);
  }

  return { matched_users: userIds.length, sent, failed };
}
