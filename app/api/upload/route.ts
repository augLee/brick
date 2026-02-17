import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file) {
    return NextResponse.json({ error: "File is required." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: "Upload endpoint scaffolded." });
}
