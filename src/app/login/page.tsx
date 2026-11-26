"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Tab = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const supabase = createClient();
    const adminEmails = ["ulton22@gmail.com", "admin@radarcupom.com"];
    const targetUrl = adminEmails.includes(email.trim().toLowerCase())
      ? "/admin"
      : "/meus-alertas";

    if (tab === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push(targetUrl);
        router.refresh();
        return;
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        router.push(targetUrl);
        router.refresh();
        return;
      } else {
        setInfo("Conta criada! Confirme seu e-mail para entrar.");
      }
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#16a34a] text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-xl font-black text-slate-900">
            Radar <span className="text-[#16a34a]">Cupom</span>
          </span>
        </Link>

        <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
          {(["login", "signup"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setError(null);
                setInfo(null);
              }}
              className={`rounded-lg py-2 transition-colors ${
                tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {t === "login" ? "Entrar" : "Criar Conta"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="E-mail"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#16a34a]"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Senha"
            autoComplete={tab === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#16a34a]"
          />
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
          {info && <p className="text-xs font-medium text-green-700">{info}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#16a34a] py-2.5 text-sm font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-60"
          >
            {loading ? "Aguarde..." : tab === "login" ? "Entrar" : "Criar Conta"}
          </button>
        </form>
      </div>
    </div>
  );
}
