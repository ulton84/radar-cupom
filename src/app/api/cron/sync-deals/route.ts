import { NextResponse } from "next/server";
import { syncDealsRobot } from "@/lib/crawler/deals";
import { getAdminUser } from "@/lib/auth/admin";

export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}

async function handleSync(request: Request) {
  const adminApiKey = process.env.ADMIN_API_KEY;
  const apiKeyHeader = request.headers.get("x-api-key");
  const authHeader = request.headers.get("authorization");

  const isApiKeyValid =
    adminApiKey &&
    (apiKeyHeader === adminApiKey || authHeader === `Bearer ${adminApiKey}`);

  const adminUser = isApiKeyValid ? null : await getAdminUser();

  if (!isApiKeyValid && !adminUser) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await syncDealsRobot();
    return NextResponse.json({
      success: true,
      message: `Robô executado com sucesso: ${result.newDealsAdded} nova(s) oferta(s) cadastrada(s)`,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao executar robô de ofertas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
