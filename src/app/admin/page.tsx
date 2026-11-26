import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminDashboard, type AdminCoupon, type AdminStore } from "./AdminDashboard";

async function AdminContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const adminEmail = process.env.ADMIN_EMAIL;

  // Protegido no servidor: permite acesso apenas se o e-mail for exatamente ADMIN_EMAIL
  if (!user || !adminEmail || user.email?.trim().toLowerCase() !== adminEmail.trim().toLowerCase()) {
    redirect("/");
  }

  let stores: AdminStore[] = [];
  let coupons: AdminCoupon[] = [];

  try {
    const adminSupabase = createAdminClient();

    const [storesRes, couponsRes] = await Promise.all([
      adminSupabase.from("stores").select("id, name, slug, is_active").order("name", { ascending: true }),
      adminSupabase
        .from("coupons")
        .select(
          "id, store_id, title, description, code, discount_label, max_price_cents, affiliate_url, is_active, stores(id, name, slug)"
        )
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (storesRes.data) stores = storesRes.data as AdminStore[];
    if (couponsRes.data) coupons = couponsRes.data as unknown as AdminCoupon[];
  } catch (err) {
    console.error("Erro ao carregar dados do admin:", err);
  }

  return (
    <AdminDashboard
      initialStores={stores}
      initialCoupons={coupons}
      adminEmail={user.email || adminEmail}
    />
  );
}

function AdminFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#16a34a] border-r-transparent" />
        <p className="mt-3 text-sm text-slate-500">Carregando painel administrativo...</p>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminContent />
    </Suspense>
  );
}
