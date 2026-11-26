import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AlertsManager, type UserAlert } from "./AlertsManager";
import type { Store } from "@/types";

async function AlertasContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: alerts }, { data: stores }] = await Promise.all([
    supabase
      .from("user_alerts")
      .select("id, keyword, store_id, max_price_cents, is_active, stores(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("stores").select("id, name").eq("is_active", true).order("name"),
  ]);

  const adminEmail = process.env.ADMIN_EMAIL;
  const isAdmin = Boolean(
    user.email &&
      adminEmail &&
      user.email.trim().toLowerCase() === adminEmail.trim().toLowerCase()
  );

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
            <ArrowLeft className="h-4 w-4" /> Cupons
          </Link>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-sm"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-[#16a34a]" />
                Painel Admin
              </Link>
            )}
            <span className="text-xs text-slate-500">{user.email}</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-black text-slate-900">Meus Alertas</h1>
        <AlertsManager
          initialAlerts={(alerts ?? []) as unknown as UserAlert[]}
          stores={(stores ?? []) as Pick<Store, "id" | "name">[]}
          userId={user.id}
        />
      </main>
    </div>
  );
}

function AlertasFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#16a34a] border-r-transparent" />
        <p className="mt-3 text-sm text-slate-500">Carregando seus alertas...</p>
      </div>
    </div>
  );
}

export default function MeusAlertasPage() {
  return (
    <Suspense fallback={<AlertasFallback />}>
      <AlertasContent />
    </Suspense>
  );
}
