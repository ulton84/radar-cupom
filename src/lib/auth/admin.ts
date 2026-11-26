import { createClient } from "@/lib/supabase/server";

export async function getAdminUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail || user.email?.trim().toLowerCase() !== adminEmail.trim().toLowerCase()) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}
