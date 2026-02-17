// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Supabase 환경변수가 누락되었습니다.");
}

// 일반 사용자용 클라이언트 (클라이언트 컴포넌트용)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 서버 전용 어드민 클라이언트 (API Route에서 파일 업로드/DB 관리용)
// 서비스 롤 키를 사용하므로 RLS를 무시하고 모든 작업이 가능합니다.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export const publicBucket = process.env.SUPABASE_BUCKET || 'brickify-assets';