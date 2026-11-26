import { createClient } from "@/lib/supabase/server";

export function isUserAdmin(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();

  // Lista de e-mails com permissão de administrador
  const allowedAdmins = [
    "ulton22@gmail.com",
    "admin@radarcupom.com",
    process.env.ADMIN_EMAIL?.trim().toLowerCase(),
  ].filter(Boolean);

  return allowedAdmins.includes(normalized);
}

export async function getAdminUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;

    if (!isUserAdmin(user.email)) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}
