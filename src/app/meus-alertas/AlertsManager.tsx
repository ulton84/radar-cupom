"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Trash2, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export interface UserAlert {
  id: string;
  keyword: string;
  store_id: string | null;
  max_price_cents: number | null;
  is_active: boolean;
  stores?: { name: string } | { name: string }[] | null;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function storeName(a: UserAlert) {
  if (!a.stores) return null;
  return Array.isArray(a.stores) ? a.stores[0]?.name : a.stores.name;
}

export function AlertsManager({
  initialAlerts,
  stores,
  userId,
}: {
  initialAlerts: UserAlert[];
  stores: { id: string; name: string }[];
  userId: string;
}) {
  const router = useRouter();
  const [alerts, setAlerts] = useState(initialAlerts);
  const [keyword, setKeyword] = useState("");
  const [storeId, setStoreId] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function enableNotifications() {
    setMsg(null);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Este navegador não suporta notificações push.");
      }
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) throw new Error("Chave VAPID pública não configurada.");

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Permissão de notificação negada.");

      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid),
        }));

      const json = subscription.toJSON();
      const supabase = createClient();
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        },
        { onConflict: "endpoint" }
      );
      if (error) throw new Error(error.message);
      setMsg({ type: "ok", text: "Notificações ativadas neste aparelho!" });
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Erro ao ativar notificações." });
    }
  }

  async function createAlert(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim()) return;
    setBusy(true);
    setMsg(null);
    const price = maxPrice.trim() ? Math.round(parseFloat(maxPrice.replace(",", ".")) * 100) : null;
    if (price !== null && (isNaN(price) || price < 0)) {
      setMsg({ type: "err", text: "Valor máximo inválido." });
      setBusy(false);
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("user_alerts")
      .insert({
        user_id: userId,
        keyword: keyword.trim(),
        store_id: storeId || null,
        max_price_cents: price,
        is_active: true,
      })
      .select("id, keyword, store_id, max_price_cents, is_active, stores(name)")
      .single();
    if (error) {
      setMsg({ type: "err", text: error.message });
    } else {
      setAlerts([data as unknown as UserAlert, ...alerts]);
      setKeyword("");
      setStoreId("");
      setMaxPrice("");
    }
    setBusy(false);
  }

  async function deleteAlert(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("user_alerts").delete().eq("id", id);
    if (error) setMsg({ type: "err", text: error.message });
    else setAlerts(alerts.filter((a) => a.id !== id));
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  const input =
    "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#16a34a]";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={enableNotifications}
          className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700"
        >
          <Bell className="h-4 w-4" /> Ativar Notificações neste Aparelho
        </button>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>

      {msg && (
        <p className={`text-sm font-medium ${msg.type === "ok" ? "text-green-700" : "text-red-600"}`}>
          {msg.text}
        </p>
      )}

      <form onSubmit={createAlert} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-slate-900">Novo alerta</h2>
        <input
          required
          placeholder="Palavra-chave (ex: tênis)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className={input}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className={input}>
            <option value="">Qualquer loja</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            inputMode="decimal"
            placeholder="Valor máximo em R$ (opcional)"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className={input}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          Criar alerta
        </button>
      </form>

      <ul className="space-y-2">
        {alerts.length === 0 && <li className="text-sm text-slate-500">Nenhum alerta criado ainda.</li>}
        {alerts.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <div className="text-sm">
              <p className="font-bold text-slate-900">{a.keyword}</p>
              <p className="text-xs text-slate-500">
                {storeName(a) ?? "Qualquer loja"} ·{" "}
                {a.max_price_cents != null
                  ? `até R$ ${(a.max_price_cents / 100).toFixed(2).replace(".", ",")}`
                  : "qualquer preço"}
              </p>
            </div>
            <button
              onClick={() => deleteAlert(a.id)}
              aria-label="Excluir alerta"
              className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
