import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function isAllowedImageHost(hostname: string) {
  return /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.supabase\.co$/i.test(hostname);
}

export async function GET(req: Request) {
  try {
    const searchParams = new URL(req.url).searchParams;
    const rawUrl = searchParams.get("url");

    if (!rawUrl) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const target = new URL(rawUrl);
    if (target.protocol !== "https:") {
      return NextResponse.json({ error: "Only https is allowed" }, { status: 400 });
    }
    if (!isAllowedImageHost(target.hostname)) {
      return NextResponse.json({ error: "Host is not allowed" }, { status: 400 });
    }
    if (!target.pathname.startsWith("/storage/v1/object/public/")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const res = await fetch(target.href);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream fetch failed: ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/png";

    return new Response(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
}
