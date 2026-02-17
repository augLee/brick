import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type CheckoutBody = {
  jobId?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CheckoutBody;
    const jobId = body.jobId?.trim() || randomUUID();
    const origin = new URL(req.url).origin;

    return NextResponse.json({
      sessionId: `sess_${randomUUID()}`,
      checkoutUrl: `${origin}/success?jobId=${encodeURIComponent(jobId)}`,
      amount: 4900,
      currency: "KRW",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "결제 세션 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
