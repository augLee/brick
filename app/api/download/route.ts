import { NextResponse } from "next/server";
import { getSupabaseAdminClient, publicBucket } from "@/lib/supabase";

export const runtime = "edge";

type DownloadFile = { name: string; url?: string; status?: string; capacity?: string };

type DownloadPayload = {
  jobId: string;
  meta?: {
    previewImageUrl: string;
    palette8: string[];
    mask64: number[][];
  };
  files: DownloadFile[];
  note?: string;
  error?: string;
};

type MetaJson = {
  previewImageUrl: string;
  palette8: string[];
  mask64: number[][];
};

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isMask64(v: unknown): v is number[][] {
  return (
    Array.isArray(v) &&
    v.length === 64 &&
    v.every(
      (row) =>
        Array.isArray(row) &&
        row.length === 64 &&
        row.every((n) => typeof n === "number" && (n === 0 || n === 1))
    )
  );
}

function isValidMeta(meta: unknown): meta is MetaJson {
  if (!meta || typeof meta !== "object") return false;
  const m = meta as Record<string, unknown>;

  return (
    typeof m.previewImageUrl === "string" &&
    isStringArray(m.palette8) &&
    m.palette8.length === 8 &&
    isMask64(m.mask64)
  );
}

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

    // 1) 폴더 파일 목록
    const { data: renderFiles, error: listError } = await supabaseAdmin.storage
      .from(publicBucket)
      .list(renderFolder, { limit: 200 });

    if (listError) {
      return NextResponse.json({ error: listError.message || "렌더 파일 조회 실패" }, { status: 500 });
    }

    const filesArr = renderFiles ?? [];
    const hasFile = (name: string) => filesArr.some((f) => f.name === name);
    const findStartsWith = (prefix: string) => filesArr.find((f) => f.name.startsWith(prefix));

    // 2) meta.json 다운로드
    let meta: MetaJson | null = null;
    const metaPath = `${renderFolder}/meta.json`;
    const { data: metaFile, error: metaErr } = await supabaseAdmin.storage.from(publicBucket).download(metaPath);

    if (!metaErr && metaFile) {
      try {
        const metaText = await metaFile.text();
        const parsed: unknown = JSON.parse(metaText);
        if (isValidMeta(parsed)) meta = parsed;
      } catch {
        meta = null;
      }
    }

    // 3) preview URL
    const previewFile = findStartsWith("preview.");
    const previewUrl =
      previewFile
        ? supabaseAdmin.storage
            .from(publicBucket)
            .getPublicUrl(`${renderFolder}/${previewFile.name}`).data.publicUrl
        : meta?.previewImageUrl;

    if (!previewUrl) {
      return NextResponse.json({ error: "해당 jobId의 미리보기/메타를 찾을 수 없습니다." }, { status: 404 });
    }

    // 4) CSV 존재 여부 + URL
    const csvName = "parts-list.csv";
    const csvPath = `${renderFolder}/${csvName}`;
    const csvExists = hasFile(csvName);
    const csvUrl = supabaseAdmin.storage.from(publicBucket).getPublicUrl(csvPath).data.publicUrl;

    const responseFiles: DownloadFile[] = [
      {
        name: previewFile ? `brickify-${previewFile.name}` : "preview.png",
        url: previewUrl,
      },
      csvExists
        ? { name: csvName, url: csvUrl }
        : { name: csvName, status: "준비중", capacity: "브라우저에서 부품표 계산 후 생성됩니다." },
      { name: "build-guide.pdf", status: "준비중" },
      { name: "story-card.txt", status: "준비중" },
    ];

    const payload: DownloadPayload = {
      jobId,
      files: responseFiles,
      note: "부품표(CSV)는 최초 1회 생성 후 다운로드할 수 있습니다.",
    };

    if (!csvExists && meta) {
      payload.meta = {
        previewImageUrl: meta.previewImageUrl,
        palette8: meta.palette8,
        mask64: meta.mask64,
      };
    }

    if (!csvExists && !meta) {
      payload.note = "부품표 생성에 필요한 meta.json이 없습니다. (generate-render에서 meta 저장이 되었는지 확인 필요)";
    }

    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "다운로드 패키지 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}