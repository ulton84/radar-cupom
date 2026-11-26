import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Search, Store as StoreIcon, Filter, X, Sparkles, AlertCircle, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CouponCard } from "@/components/CouponCard";
import type { Coupon, Store } from "@/types";

interface SearchParamsProps {
  searchParams: Promise<{
    q?: string;
    store?: string;
    maxPrice?: string;
  }>;
}

async function CouponContent({ searchParams }: SearchParamsProps) {
  await connection();
  const { q = "", store = "", maxPrice = "" } = await searchParams;

  let stores: Store[] = [];
  let coupons: Coupon[] = [];
  let errorMessage: string | null = null;

  try {
    const supabase = await createClient();

    // 1. Busca lojas ativas para o select de filtros
    const { data: storesData, error: storesError } = await supabase
      .from("stores")
      .select("id, name, slug, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (storesError) {
      console.warn("Aviso ao buscar stores:", storesError.message);
    } else if (storesData) {
      stores = storesData as Store[];
    }

    // 2. Monta a query de cupons ativos com join em stores
    let query = supabase
      .from("coupons")
      .select(
        `
        id,
        store_id,
        title,
        description,
        code,
        discount_label,
        max_price_cents,
        affiliate_url,
        is_active,
        stores (
          id,
          name,
          slug,
          logo_url
        )
      `
      )
      .eq("is_active", true);

    // Filtro por texto no título com ilike
    if (q.trim()) {
      query = query.ilike("title", `%${q.trim()}%`);
    }

    // Filtro por loja
    if (store.trim()) {
      query = query.eq("store_id", store.trim());
    }

    // Filtro por valor teto: max_price_cents <= valor em centavos
    if (maxPrice.trim() && !isNaN(Number(maxPrice))) {
      const priceInCents = Math.round(parseFloat(maxPrice) * 100);
      if (priceInCents >= 0) {
        query = query.lte("max_price_cents", priceInCents);
      }
    }

    const { data: couponsData, error: couponsError } = await query;

    if (couponsError) {
      console.error("Erro ao carregar cupons:", couponsError.message);
      errorMessage = couponsError.message;
    } else if (couponsData) {
      coupons = (couponsData as unknown as Array<Coupon & { stores?: Store | Store[] | null }>).map((item) => ({
        ...item,
        stores: Array.isArray(item.stores) ? item.stores[0] : item.stores,
      })) as Coupon[];
    }
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : "Erro de conexão com o banco de dados";
    console.error("Erro ao conectar no Supabase:", err);
    errorMessage = errMessage;
  }

  const hasActiveFilters = Boolean(q.trim() || store.trim() || maxPrice.trim());

  return (
    <>
      {/* Hero Section & Filtros */}
      <section className="border-b border-slate-200/60 bg-gradient-to-b from-white to-[#f8fafc] py-10 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3.5 py-1 text-xs font-bold text-green-700 border border-green-200 mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Economia inteligente em tempo real
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Economize agora com os melhores cupons
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-slate-600">
            Filtre por loja, busque pelo produto desejado ou defina o valor máximo que deseja pagar.
          </p>
        </div>

        {/* Barra de Filtros via URL (searchParams) */}
        <div className="mx-auto mt-8 max-w-5xl">
          <form
            method="GET"
            action="/"
            className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-end sm:gap-3"
          >
            {/* Campo 1: Busca por texto (q) */}
            <div className="flex-1">
              <label
                htmlFor="search-q"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Buscar Cupom
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="search-q"
                  type="text"
                  name="q"
                  defaultValue={q}
                  placeholder="Ex: Tênis, 20% OFF, iPhone..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/20 transition-all"
                />
              </div>
            </div>

            {/* Campo 2: Select de Loja (store) */}
            <div className="w-full sm:w-56">
              <label
                htmlFor="select-store"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Loja Parceira
              </label>
              <div className="relative">
                <StoreIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select
                  id="select-store"
                  name="store"
                  defaultValue={store}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-8 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/20 transition-all"
                >
                  <option value="">Todas as lojas</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  ▼
                </div>
              </div>
            </div>

            {/* Campo 3: Numérico Quero pagar até (R$) (maxPrice) */}
            <div className="w-full sm:w-52">
              <label
                htmlFor="input-max-price"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Quero pagar até (R$)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                  R$
                </span>
                <input
                  id="input-max-price"
                  type="number"
                  name="maxPrice"
                  step="0.01"
                  min="0"
                  defaultValue={maxPrice}
                  placeholder="0,00"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/20 transition-all"
                />
              </div>
            </div>

            {/* Botão de Filtrar */}
            <div className="flex gap-2 pt-1 sm:pt-0">
              <button
                type="submit"
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#15803d] active:scale-[0.98] transition-all cursor-pointer"
              >
                <Filter className="h-4 w-4" />
                <span>Filtrar</span>
              </button>

              {/* Botão de Limpar Filtros quando ativos */}
              {hasActiveFilters && (
                <Link
                  href="/"
                  title="Limpar filtros"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors"
                >
                  <X className="h-4 w-4" />
                </Link>
              )}
            </div>
          </form>

          {/* Tags de Filtros Ativos */}
          {hasActiveFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-2 px-1 text-xs text-slate-500">
              <span className="font-semibold">Filtros ativos:</span>
              {q.trim() && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">
                  Busca: &ldquo;{q}&rdquo;
                </span>
              )}
              {store.trim() && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">
                  Loja: {stores.find((s) => s.id === store)?.name || store}
                </span>
              )}
              {maxPrice.trim() && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">
                  Até R$ {parseFloat(maxPrice).toFixed(2)}
                </span>
              )}
              <Link
                href="/"
                className="text-[#16a34a] font-semibold hover:underline ml-1"
              >
                Limpar todos
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Conteúdo Principal / Grid de Cupons */}
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Alerta de erro de conexão, se houver */}
        {errorMessage && (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Aviso de Configuração do Supabase</p>
              <p className="mt-0.5 text-xs text-amber-700">
                Certifique-se de configurar as variáveis de ambiente{" "}
                <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono">
                  NEXT_PUBLIC_SUPABASE_URL
                </code>{" "}
                e{" "}
                <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono">
                  NEXT_PUBLIC_SUPABASE_ANON_KEY
                </code>{" "}
                no arquivo <code className="font-mono">.env.local</code>.
              </p>
            </div>
          </div>
        )}

        {/* Cabeçalho da Lista */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Cupons em Destaque
          </h2>
          <span className="text-xs font-medium text-slate-500">
            Mostrando {coupons.length} {coupons.length === 1 ? "resultado" : "resultados"}
          </span>
        </div>

        {/* Grid de Cards ou Estado Vazio */}
        {coupons.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {coupons.map((coupon) => (
              <CouponCard key={coupon.id} coupon={coupon} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 px-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-4">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Nenhum cupom encontrado
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              {hasActiveFilters
                ? "Tente ajustar ou limpar os filtros para visualizar mais ofertas disponíveis."
                : "Não há cupons ativos cadastrados no momento. Volte em breve!"}
            </p>
            {hasActiveFilters && (
              <div className="mt-5">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Limpar todos os filtros
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}

function PageFallback() {
  return (
    <div className="py-20 text-center">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#16a34a] border-r-transparent" />
      <p className="mt-3 text-sm text-slate-500">Carregando cupons e ofertas...</p>
    </div>
  );
}

export default function HomePage({ searchParams }: SearchParamsProps) {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#16a34a] text-white shadow-sm shadow-green-600/30 group-hover:scale-105 transition-transform">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-slate-900">
                Radar <span className="text-[#16a34a]">Cupom</span>
              </span>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider -mt-1">
                Descontos Verificados
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              Painel Admin
            </Link>
            <Link
              href="/meus-alertas"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#16a34a] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-green-700 transition-colors"
            >
              <Bell className="h-4 w-4" />
              Meus Alertas / Entrar
            </Link>
          </div>
        </div>
      </header>

      {/* Dynamic Content wrapped in Suspense for PPR streaming */}
      <div className="flex-1">
        <Suspense fallback={<PageFallback />}>
          <CouponContent searchParams={searchParams} />
        </Suspense>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p>© 2026 Radar Cupom. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
