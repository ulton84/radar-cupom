"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Store as StoreIcon,
  Ticket,
  Bell,
  Trash2,
  Play,
  Pause,
  ExternalLink,
  Plus,
  LogOut,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Bot,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export interface AdminStore {
  id: string;
  name: string;
  slug?: string | null;
  is_active?: boolean;
}

export interface AdminCoupon {
  id: string;
  store_id?: string | null;
  title: string;
  description?: string | null;
  code?: string | null;
  discount_label?: string | null;
  max_price_cents?: number | null;
  affiliate_url: string;
  is_active: boolean;
  stores?: { id: string; name: string; slug?: string | null } | null;
}

function slugify(text: string) {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function AdminDashboard({
  initialStores,
  initialCoupons,
  adminEmail,
}: {
  initialStores: AdminStore[];
  initialCoupons: AdminCoupon[];
  adminEmail: string;
}) {
  const router = useRouter();
  const [stores, setStores] = useState<AdminStore[]>(initialStores);
  const [coupons, setCoupons] = useState<AdminCoupon[]>(initialCoupons);

  // Formulário de Loja
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [storeLoading, setStoreLoading] = useState(false);
  const [storeMsg, setStoreMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Formulário de Cupom
  const [couponStoreId, setCouponStoreId] = useState("");
  const [couponTitle, setCouponTitle] = useState("");
  const [couponDesc, setCouponDesc] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState("");
  const [couponPrice, setCouponPrice] = useState("");
  const [couponUrl, setCouponUrl] = useState("");
  const [couponNotify, setCouponNotify] = useState(true);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMsg, setCouponMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Robô de Ofertas
  const [robotLoading, setRobotLoading] = useState(false);
  const [robotMsg, setRobotMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleRunRobot() {
    setRobotLoading(true);
    setRobotMsg(null);
    try {
      const res = await fetch("/api/cron/sync-deals", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao executar robô de ofertas");

      setRobotMsg({
        type: "ok",
        text: `${data.message}. (Notificações disparadas no Web Push e WhatsApp)!`,
      });

      if (data.deals && data.deals.length > 0) {
        setCoupons((prev) => [...data.deals, ...prev]);
        router.refresh();
      }
    } catch (err) {
      setRobotMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Erro ao executar robô",
      });
    } finally {
      setRobotLoading(false);
    }
  }

  // Ações rápidas
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  async function handleCreateStore(e: React.FormEvent) {
    e.preventDefault();
    if (!storeName.trim()) return;

    setStoreLoading(true);
    setStoreMsg(null);

    try {
      const res = await fetch("/api/admin/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: storeName.trim(),
          slug: storeSlug.trim() || slugify(storeName),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar loja");

      setStores((prev) => [...prev, data.store].sort((a, b) => a.name.localeCompare(b.name)));
      setStoreName("");
      setStoreSlug("");
      setStoreMsg({ type: "ok", text: `Loja "${data.store.name}" cadastrada com sucesso!` });
    } catch (err) {
      setStoreMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setStoreLoading(false);
    }
  }

  async function handleCreateCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!couponTitle.trim() || !couponStoreId || !couponUrl.trim()) {
      setCouponMsg({ type: "err", text: "Preencha a loja, o título e a URL de afiliado." });
      return;
    }

    setCouponLoading(true);
    setCouponMsg(null);

    let priceInCents: number | null = null;
    if (couponPrice.trim()) {
      const parsed = parseFloat(couponPrice.replace(",", "."));
      if (isNaN(parsed) || parsed < 0) {
        setCouponMsg({ type: "err", text: "Valor em R$ inválido." });
        setCouponLoading(false);
        return;
      }
      priceInCents = Math.round(parsed * 100);
    }

    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: couponStoreId,
          title: couponTitle.trim(),
          description: couponDesc.trim() || null,
          code: couponCode.trim() || null,
          discount_label: couponDiscount.trim() || null,
          max_price_cents: priceInCents,
          affiliate_url: couponUrl.trim(),
          is_active: true,
          notify: couponNotify,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao cadastrar cupom");

      setCoupons((prev) => [data.coupon, ...prev]);

      // Feedback detalhado sobre push
      let feedback = `Cupom "${data.coupon.title}" criado com sucesso!`;
      if (data.push) {
        feedback += ` Push: ${data.push.sent} enviados (${data.push.matched_users} usuários combinados).`;
      } else if (data.pushError) {
        feedback += ` (Aviso no push: ${data.pushError})`;
      }

      setCouponMsg({ type: "ok", text: feedback });

      // Limpa campos
      setCouponTitle("");
      setCouponDesc("");
      setCouponCode("");
      setCouponDiscount("");
      setCouponPrice("");
      setCouponUrl("");
    } catch (err) {
      setCouponMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Erro ao cadastrar cupom",
      });
    } finally {
      setCouponLoading(false);
    }
  }

  async function handleToggleStatus(coupon: AdminCoupon) {
    setActionLoadingId(coupon.id);
    const newStatus = !coupon.is_active;

    try {
      const res = await fetch("/api/admin/coupons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: coupon.id, is_active: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao alterar status");

      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, is_active: newStatus } : c))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao atualizar cupom");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDeleteCoupon(id: string) {
    if (!confirm("Tem certeza que deseja excluir este cupom permanentemente?")) return;

    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/admin/coupons?id=${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao excluir cupom");

      setCoupons((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao excluir cupom");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const inputStyle =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#16a34a] focus:ring-2 focus:ring-green-500/20";

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#16a34a] text-white shadow-sm shadow-green-600/30 group-hover:scale-105 transition-transform">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-lg font-black tracking-tight text-slate-900">
                Radar <span className="text-[#16a34a]">Cupom</span>
              </span>
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              <ShieldCheck className="h-3.5 w-3.5 text-[#16a34a]" />
              Painel Admin
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden md:inline-block text-xs font-medium text-slate-500">
              Conectado como <strong className="text-slate-700">{adminEmail}</strong>
            </span>
            <button
              onClick={handleRunRobot}
              disabled={robotLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-[#16a34a] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:from-emerald-700 hover:to-green-700 transition-all disabled:opacity-60"
              title="Busca ofertas e cupons automaticamente na internet"
            >
              <Bot className="h-4 w-4" />
              {robotLoading ? "Minerando Ofertas..." : "Robô de Ofertas"}
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Ver Vitrine
            </Link>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
              title="Encerrar sessão"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Banner de Feedback do Robô de Ofertas */}
        {robotMsg && (
          <div
            className={`flex items-center gap-2.5 rounded-2xl p-4 text-sm font-semibold shadow-sm ${
              robotMsg.type === "ok"
                ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {robotMsg.type === "ok" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#16a34a]" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            )}
            <span>{robotMsg.text}</span>
          </div>
        )}

        {/* Grid de Formulários de Criação */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Card 1: Cadastrar Nova Loja */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-[#16a34a]">
                <StoreIcon className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Nova Loja</h2>
                <p className="text-xs text-slate-500">Cadastre marcas para vincular cupons</p>
              </div>
            </div>

            {storeMsg && (
              <div
                className={`mb-4 flex items-center gap-2 rounded-xl p-3 text-xs font-medium ${
                  storeMsg.type === "ok"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-600 border border-red-200"
                }`}
              >
                {storeMsg.type === "ok" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{storeMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleCreateStore} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Nome da Loja <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Nike, Amazon, Magazine Luiza"
                  value={storeName}
                  onChange={(e) => {
                    setStoreName(e.target.value);
                    if (!storeSlug || storeSlug === slugify(storeName)) {
                      setStoreSlug(slugify(e.target.value));
                    }
                  }}
                  className={inputStyle}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Slug URL <span className="text-slate-400 font-normal">(automático)</span>
                </label>
                <input
                  type="text"
                  placeholder="ex: nike"
                  value={storeSlug}
                  onChange={(e) => setStoreSlug(slugify(e.target.value))}
                  className={inputStyle}
                />
              </div>

              <button
                type="submit"
                disabled={storeLoading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors"
              >
                <Plus className="h-4 w-4" />
                {storeLoading ? "Cadastrando..." : "Cadastrar Loja"}
              </button>
            </form>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Lojas ativas ({stores.length})
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {stores.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Cadastrar Novo Cupom */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-[#16a34a]">
                  <Ticket className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Cadastrar Novo Cupom</h2>
                  <p className="text-xs text-slate-500">
                    Crie e publique descontos com disparo opcional de notificações Push
                  </p>
                </div>
              </div>
            </div>

            {couponMsg && (
              <div
                className={`mb-4 flex items-center gap-2 rounded-xl p-3.5 text-xs font-medium ${
                  couponMsg.type === "ok"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-600 border border-red-200"
                }`}
              >
                {couponMsg.type === "ok" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16a34a]" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                )}
                <span>{couponMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleCreateCoupon} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Loja <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={couponStoreId}
                    onChange={(e) => setCouponStoreId(e.target.value)}
                    className={inputStyle}
                  >
                    <option value="">Selecione uma loja...</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Título da Oferta / Cupom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Tênis Air Max 90 com 30% de desconto"
                    value={couponTitle}
                    onChange={(e) => setCouponTitle(e.target.value)}
                    className={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Descrição ou Regras <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Válido para itens selecionados vendidos e entregues pela loja"
                  value={couponDesc}
                  onChange={(e) => setCouponDesc(e.target.value)}
                  className={inputStyle}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Código do Cupom <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: NIKE30"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className={inputStyle}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Etiqueta de Desconto <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 30% OFF ou R$ 50 OFF"
                    value={couponDiscount}
                    onChange={(e) => setCouponDiscount(e.target.value)}
                    className={inputStyle}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Preço Máximo (R$) <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 199,90"
                    value={couponPrice}
                    onChange={(e) => setCouponPrice(e.target.value)}
                    className={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  URL de Afiliado / Link de Destino <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://loja.com/produto?affid=..."
                  value={couponUrl}
                  onChange={(e) => setCouponUrl(e.target.value)}
                  className={inputStyle}
                />
              </div>

              {/* Checkbox de Disparo Imediato */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={couponNotify}
                    onChange={(e) => setCouponNotify(e.target.checked)}
                    className="h-4 w-4 rounded text-[#16a34a] focus:ring-green-500 cursor-pointer"
                  />
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-[#16a34a]" />
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Disparar notificação push imediatamente
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Envia alerta instantâneo para todos os aparelhos cadastrados com alerta compatível
                      </p>
                    </div>
                  </div>
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={couponLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-green-700 disabled:opacity-60 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  {couponLoading ? "Salvando e Notificando..." : "Cadastrar Cupom"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Seção de Cupons Cadastrados */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Cupons Cadastrados</h2>
              <p className="text-xs text-slate-500">
                Gerencie o status ou remova cupons ativos e pausados
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {coupons.length} {coupons.length === 1 ? "cupom" : "cupons"}
            </span>
          </div>

          {coupons.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              Nenhum cupom cadastrado ainda. Use o formulário acima para adicionar o primeiro.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Cupom / Oferta</th>
                    <th className="px-6 py-3.5">Loja</th>
                    <th className="px-6 py-3.5">Código / Desconto</th>
                    <th className="px-6 py-3.5">Preço Máx.</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {coupons.map((c) => {
                    const storeData = c.stores as { name: string } | { name: string }[] | null;
                    const storeLabel = Array.isArray(storeData) ? storeData[0]?.name : storeData?.name;
                    const isBusy = actionLoadingId === c.id;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4 max-w-xs">
                          <p className="font-bold text-slate-900 line-clamp-1">{c.title}</p>
                          {c.description && (
                            <p className="text-xs text-slate-400 line-clamp-1">{c.description}</p>
                          )}
                          <a
                            href={c.affiliate_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#16a34a] hover:underline mt-0.5"
                          >
                            Ver link de afiliado <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            {storeLabel || "Geral"}
                          </span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {c.code ? (
                            <span className="font-mono text-xs font-bold text-slate-800 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                              {c.code}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                          {c.discount_label && (
                            <span className="ml-2 inline-block text-xs font-bold text-[#16a34a]">
                              {c.discount_label}
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-600">
                          {c.max_price_cents != null
                            ? `R$ ${(c.max_price_cents / 100).toFixed(2).replace(".", ",")}`
                            : "Qualquer"}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {c.is_active ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 border border-slate-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                              Pausado
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                          <button
                            onClick={() => handleToggleStatus(c)}
                            disabled={isBusy}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                              c.is_active
                                ? "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                            }`}
                            title={c.is_active ? "Pausar cupom" : "Ativar cupom"}
                          >
                            {c.is_active ? (
                              <>
                                <Pause className="h-3.5 w-3.5" /> Pausar
                              </>
                            ) : (
                              <>
                                <Play className="h-3.5 w-3.5" /> Ativar
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleDeleteCoupon(c.id)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
                            title="Excluir cupom"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Excluir
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
