import { NextResponse } from "next/server";

export const runtime = "edge";

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
    return NextResponse.json({
      jobId,
      files: [
        { name: "brickify-preview.svg", url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` },
        { name: "parts-list.csv", url: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}` },
        { name: "build-guide.pdf", status: "준비중", capacity: "capacity 확보 중" },
        { name: "story-card.txt", url: `data:text/plain;charset=utf-8,${encodeURIComponent(txt)}` },
      ],
      note: "층별 조립 가이드는 현재 준비중입니다. capacity 확보 후 제공됩니다.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "다운로드 패키지 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
