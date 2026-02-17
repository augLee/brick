// api/upload/route.ts
import { randomUUID } from 'crypto';
import { NextResponse } from "next/server";
import { getSupabaseAdminClient, publicBucket } from "@/lib/supabase";

export const runtime = "nodejs";

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "JPG, PNG, WebP 이미지만 가능합니다." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "파일 크기는 10MB 이하만 가능합니다." }, { status: 400 });
    }

    // 2. 파일명 생성 및 버퍼 변환 (Node 20 방식)
    const ext = file.name.split(".").pop() || "png";
    const fileName = `inputs/${randomUUID()}.${ext}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // 3. Supabase Admin 권한으로 업로드 (RLS 무시)
    const { error } = await supabaseAdmin.storage
      .from(publicBucket)
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) throw error;

    // 4. 결과 URL 반환
    const { data } = supabaseAdmin.storage.from(publicBucket).getPublicUrl(fileName);
    
    console.log("upload success:", data.publicUrl);
    return NextResponse.json({ url: data.publicUrl, fileName });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "업로드 중 오류가 발생했습니다.";
    console.error("upload error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
