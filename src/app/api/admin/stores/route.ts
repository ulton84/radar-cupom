import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

interface CreateStoreBody {
  name?: string;
  slug?: string;
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

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Acesso restrito ao administrador" }, { status: 401 });
  }

  let body: CreateStoreBody;
  try {
    body = (await request.json()) as CreateStoreBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { name, slug } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Nome da loja é obrigatório" }, { status: 400 });
  }

  const finalSlug = (slug?.trim() ? slugify(slug) : slugify(name)) || "loja";

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro de configuração Supabase" },
      { status: 500 }
    );
  }

  const { data: store, error } = await supabase
    .from("stores")
    .insert({
      name: name.trim(),
      slug: finalSlug,
      is_active: true,
    })
    .select("id, name, slug, is_active")
    .single();

  if (error || !store) {
    return NextResponse.json(
      { error: error?.message || "Erro ao cadastrar loja" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, store }, { status: 201 });
}
