import { NextResponse } from "next/server";
import { getSupabaseAdminClient, publicBucket } from "@/lib/supabase";

export const runtime = "edge";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "jobId가 필요합니다." }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "SUPABASE 환경변수를 확인해주세요." }, { status: 500 });
    }

    const renderFolder = `renders/${jobId}`;
    const { data: renderFiles, error: listError } = await supabaseAdmin.storage
      .from(publicBucket)
      .list(renderFolder, { limit: 100 });

    if (listError) {
      return NextResponse.json({ error: listError.message || "렌더 파일 조회 실패" }, { status: 500 });
    }

    const previewFile = (renderFiles ?? []).find((file) => file.name.startsWith("preview."));
    if (!previewFile) {
      return NextResponse.json({ error: "해당 jobId의 미리보기 이미지를 찾을 수 없습니다." }, { status: 404 });
    }

    const previewPath = `${renderFolder}/${previewFile.name}`;
    const { data: previewUrlData } = supabaseAdmin.storage.from(publicBucket).getPublicUrl(previewPath);

    const csv = `part,colorId,qty\nbrick_2x4,C02,12\nbrick_1x2,C01,28\nplate_1x1,C03,44\n`;
    const txt = `Brickify Story Card\njobId: ${jobId}\n\n사진의 분위기를 살린 브릭 작품을 완성해보세요.`;

    return NextResponse.json({
      jobId,
      files: [
        { name: `brickify-${previewFile.name}`, url: previewUrlData.publicUrl },
        { name: "parts-list.csv", url: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}` },
        { name: "build-guide.pdf", status: "준비중"},
        { name: "story-card.txt", url: `data:text/plain;charset=utf-8,${encodeURIComponent(txt)}` },
      ],
      note: "조립 가이드는 현재 준비중입니다.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "다운로드 패키지 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
