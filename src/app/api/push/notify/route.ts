import { NextResponse } from "next/server";
import { dispatchPushForCoupon } from "@/lib/push/notify";

export async function POST(request: Request) {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey || request.headers.get("x-api-key") !== adminKey) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let couponId: string | undefined;
  try {
    ({ coupon_id: couponId } = await request.json());
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!couponId) {
    return NextResponse.json({ error: "coupon_id obrigatório" }, { status: 400 });
  }

  try {
    const result = await dispatchPushForCoupon(couponId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno no envio push";
    const status = message === "Cupom não encontrado" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
