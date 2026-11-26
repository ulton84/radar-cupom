"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink, Store as StoreIcon, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Coupon } from "@/types";

interface CouponCardProps {
  coupon: Coupon;
}

export function CouponCard({ coupon }: CouponCardProps) {
  const [copied, setCopied] = useState(false);
  const [isClicking, setIsClicking] = useState(false);

  const storeName = coupon.stores?.name || "Loja Parceira";

  // Formata o valor teto se houver
  const formattedMaxPrice =
    coupon.max_price_cents != null && coupon.max_price_cents > 0
      ? new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(coupon.max_price_cents / 100)
      : null;

  const handleCopyCode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!coupon.code) return;

    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Falha ao copiar código:", err);
    }
  };

  const handleGetCoupon = async () => {
    if (isClicking) return;
    setIsClicking(true);

    try {
      const supabase = createClient();
      // Registra o clique via RPC no Supabase
      await supabase.rpc("increment_coupon_click", {
        coupon_id: coupon.id,
      });
    } catch (err) {
      console.error("Erro ao registrar clique do cupom:", err);
    } finally {
      setIsClicking(false);
    }

    // Abre o link de afiliado em nova aba
    if (coupon.affiliate_url) {
      window.open(coupon.affiliate_url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-green-300 hover:shadow-md">
      <div>
        {/* Top bar: Loja e Selo de Desconto */}
        <div className="flex items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <StoreIcon className="h-4 w-4 text-slate-400" />
            <span className="truncate max-w-[140px] sm:max-w-[180px] font-semibold text-slate-700">
              {storeName}
            </span>
          </div>

          {coupon.discount_label && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-bold text-green-700 border border-green-200/60 shadow-xs">
              <Tag className="h-3 w-3" />
              {coupon.discount_label}
            </span>
          )}
        </div>

        {/* Título do Cupom */}
        <h3 className="text-base font-bold text-slate-900 group-hover:text-green-700 transition-colors line-clamp-2">
          {coupon.title}
        </h3>

        {/* Descrição */}
        {coupon.description && (
          <p className="mt-2 text-xs leading-relaxed text-slate-600 line-clamp-2">
            {coupon.description}
          </p>
        )}

        {/* Valor Teto / Limite de Preço */}
        {formattedMaxPrice && (
          <div className="mt-3 inline-flex items-center rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 border border-amber-200/50">
            <span>
              Pague até: <strong>{formattedMaxPrice}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Seção de Ações: Código e Botão de Afiliado */}
      <div className="mt-5 space-y-2.5 pt-3 border-t border-slate-100">
        {coupon.code ? (
          <div className="flex items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-3 py-1.5">
            <span className="font-mono text-sm font-bold tracking-wider text-slate-800">
              {coupon.code}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              aria-label="Copiar código do cupom"
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                copied
                  ? "bg-green-600 text-white shadow-xs"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-500" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-xs text-slate-500 font-medium">
            Desconto ativado direto no link
          </div>
        )}

        {/* Botão Principal Pegar Cupom */}
        <button
          type="button"
          onClick={handleGetCoupon}
          disabled={isClicking}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#15803d] active:scale-[0.99] disabled:opacity-70 cursor-pointer"
        >
          <span>Pegar Cupom</span>
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
