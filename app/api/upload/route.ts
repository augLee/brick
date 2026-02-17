// api/upload/route.ts
import { randomUUID } from 'crypto';
import { NextResponse } from "next/server";
import { getSupabaseAdminClient, publicBucket } from "@/lib/supabase";

export const runtime = "nodejs";

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function detectMimeFromBuffer(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "SUPABASE 환경변수를 확인해주세요." }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 });
    }

    // 1. 보안 및 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "파일 크기는 10MB 이하만 가능합니다." }, { status: 400 });
    }

    // 2. 파일 시그니처 검증 (MIME 위조 방지)
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const detectedMime = detectMimeFromBuffer(fileBuffer);
    if (!detectedMime || !ALLOWED_TYPES.includes(detectedMime)) {
      return NextResponse.json({ error: "이미지 파일(JPG, PNG, WebP)만 업로드할 수 있습니다." }, { status: 400 });
    }
    if (file.type && file.type !== detectedMime) {
      return NextResponse.json({ error: "파일 형식이 올바르지 않습니다. 실제 이미지 파일만 업로드해주세요." }, { status: 400 });
    }

    // 3. 파일명 생성 (검증된 MIME 기준 확장자 사용)
    const ext = EXT_BY_MIME[detectedMime] || "png";
    const fileName = `inputs/${randomUUID()}.${ext}`;

    // 4. Supabase Admin 권한으로 업로드 (RLS 무시)
    const { error } = await supabaseAdmin.storage
      .from(publicBucket)
      .upload(fileName, fileBuffer, {
        contentType: detectedMime,
        upsert: false,
      });

    if (error) throw error;

    // 5. 결과 URL 반환
    const { data } = supabaseAdmin.storage.from(publicBucket).getPublicUrl(fileName);
    
    console.log("upload success:", data.publicUrl);
    return NextResponse.json({ url: data.publicUrl, fileName });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "업로드 중 오류가 발생했습니다.";
    console.error("upload error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
