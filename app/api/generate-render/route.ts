import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body?.imageUrl) {
    return NextResponse.json({ error: "imageUrl is required." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: "Render generation endpoint scaffolded." });
}
