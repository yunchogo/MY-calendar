// src/lib/supabaseClient.js
//
// Supabase 클라이언트를 한 번만 생성해서 앱 전체에서 재사용합니다.
// .env.local 파일에 아래 두 값을 넣어주세요 (Vite 기준):
//
//   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
//
// 두 값 모두 Supabase 대시보드 → Project Settings → API 에서 확인할 수 있어요.
// anon key는 "공개해도 되는" 키입니다 (RLS가 실제 보안을 담당해요).
// service_role 키는 절대 프론트엔드 코드에 넣지 마세요.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase 환경변수가 없어요. .env.local에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 설정해주세요."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
