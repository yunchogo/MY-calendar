-- ============================================================
-- Bboggl · AI 테마(레퍼런스 이미지 분석) 저장을 위한 스키마 보완
-- 업로드한 캘린더 사진을 AI가 분석해 만든 테마 객체(JSON)를 통째로 저장해요.
-- (기존 active_template_id/색상 컬럼은 그대로 두고, 커스텀 테마만 별도 보관)
-- Supabase SQL Editor에서 한 번 실행하세요.
-- ============================================================

alter table public.profiles add column if not exists custom_theme jsonb;
