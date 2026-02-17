// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let warned = false;

function warnMissingEnv() {
  if (warned) return;
  warned = true;
  console.error("Supabase 환경변수가 누락되었습니다.");
}

// 일반 사용자용 클라이언트 (클라이언트 컴포넌트용)
export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    warnMissingEnv();
    return null;
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

// 서버 전용 어드민 클라이언트 (API Route에서 파일 업로드/DB 관리용)
export function getSupabaseAdminClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    warnMissingEnv();
    return null;
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const publicBucket = process.env.SUPABASE_BUCKET || 'brickify-assets';
