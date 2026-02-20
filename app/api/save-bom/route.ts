// app/api/save-bom/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdminClient, publicBucket } from "@/lib/supabase";

export const runtime = "edge";

type BomItem = { part: string; color: string; count: number };
type BomResult = { bom: BomItem[]; totalPieces: number; totalStuds: number; uniqueItems: number };

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function bomToCsv(bom: BomItem[]) {
  const header = ["part", "color", "count"].join(",");
  const rows = bom.map((x) => [x.part, x.color, x.count].map(csvEscape).join(","));
  return [header, ...rows].join("\n");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      jobId?: string;
      result?: BomResult;
    };

    const jobId = body.jobId;
    const result = body.result;

    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json({ error: "jobId가 필요합니다." }, { status: 400 });
    }
    if (!result || !Array.isArray(result.bom)) {
      return NextResponse.json({ error: "result.bom이 필요합니다." }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "SUPABASE 환경변수를 확인해주세요." }, { status: 500 });
    }

    const folder = `renders/${jobId}`;
    const bomJsonPath = `${folder}/bom.json`;
    const csvPath = `${folder}/parts-list.csv`;

    // 1) bom.json 저장
    const bomJson = JSON.stringify(result);
    const { error: bomErr } = await supabaseAdmin.storage.from(publicBucket).upload(
      bomJsonPath,
      new TextEncoder().encode(bomJson),
      { contentType: "application/json", upsert: true }
    );
    if (bomErr) return NextResponse.json({ error: bomErr.message }, { status: 500 });

    // 2) CSV 저장
    const csv = bomToCsv(result.bom);
    const { error: csvErr } = await supabaseAdmin.storage.from(publicBucket).upload(
      csvPath,
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      { contentType: "text/csv;charset=utf-8", upsert: true }
    );
    if (csvErr) return NextResponse.json({ error: csvErr.message }, { status: 500 });

    const { data: csvUrl } = supabaseAdmin.storage.from(publicBucket).getPublicUrl(csvPath);

    return NextResponse.json({ ok: true, csvUrl: csvUrl.publicUrl });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "save-bom 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}