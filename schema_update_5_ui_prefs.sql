-- ============================================================
-- Bboggl · 계정 저장(꾸미기 상태) 스키마 보완
-- 스티커, 배경 이미지 투명도 등 "화면 꾸미기" 상태를 계정에 저장해
-- 다른 기기에서 로그인해도 그대로 보이게 합니다.
-- (AI 테마용 custom_theme 컬럼도 아직 없을 수 있어 함께 추가 — 이미 있으면 그냥 넘어감)
-- Supabase SQL Editor에서 이 파일 내용을 한 번 실행하세요.
-- ============================================================

-- AI 테마(레퍼런스 이미지로 만든 테마) 저장용 (schema_update_4와 동일, 안전하게 재실행 가능)
alter table public.profiles add column if not exists custom_theme jsonb;

-- 스티커 목록 / 배경 투명도 등 꾸미기 상태 저장용
--   예: { "stickers": [ { "id": "...", "src": "data:image/...", "x": 200, "y": 180,
--                         "base": 130, "scale": 1.5, "rotation": 20, "z": 1 } ],
--         "bgOpacity": 0.16 }
alter table public.profiles add column if not exists ui_prefs jsonb;
