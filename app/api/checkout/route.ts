import { NextResponse } from "next/server";
import { isServerAdminModeEnabled } from "@/lib/admin-mode";

export const runtime = "edge";

type CheckoutBody = {
  jobId?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CheckoutBody;
    const jobId = body.jobId?.trim() || crypto.randomUUID();
    const origin = new URL(req.url).origin;

    if (isServerAdminModeEnabled) {
      return NextResponse.json({
        sessionId: `admin_bypass_${crypto.randomUUID()}`,
        checkoutUrl: `${origin}/success?jobId=${encodeURIComponent(jobId)}`,
        amount: 0,
        currency: "KRW",
        bypassed: true,
      });
    }

    return NextResponse.json({
      sessionId: `sess_${crypto.randomUUID()}`,
      checkoutUrl: `${origin}/success?jobId=${encodeURIComponent(jobId)}`,
      amount: 4900,
      currency: "KRW",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "결제 세션 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
