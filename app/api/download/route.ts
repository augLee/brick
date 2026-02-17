import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "jobId가 필요합니다." }, { status: 400 });
    }

    const csv = `part,colorId,qty\nbrick_2x4,C02,12\nbrick_1x2,C01,28\nplate_1x1,C03,44\n`;
    const txt = `Brickify Story Card\njobId: ${jobId}\n\n사진의 분위기를 살린 브릭 작품을 완성해보세요.`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#FAF9F6"/><rect x="300" y="520" width="170" height="150" rx="18" fill="#27272A"/><rect x="500" y="520" width="170" height="150" rx="18" fill="#52525B"/><rect x="390" y="360" width="290" height="140" rx="20" fill="#C2410C"/></svg>`;
    const pdfMinimal = "%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF";

    return NextResponse.json({
      jobId,
      files: [
        { name: "brickify-preview.svg", url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` },
        { name: "parts-list.csv", url: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}` },
        { name: "build-guide.pdf", url: `data:application/pdf;charset=utf-8,${encodeURIComponent(pdfMinimal)}` },
        { name: "story-card.txt", url: `data:text/plain;charset=utf-8,${encodeURIComponent(txt)}` },
      ],
      note: "MVP 단계에서는 데모 링크를 반환합니다.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "다운로드 패키지 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
