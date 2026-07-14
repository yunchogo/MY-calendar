-- ============================================================
-- Bboggl · 스키마 보완: user_id 자동 채움
-- (이미 schema.sql을 실행하셨다면, 이 파일만 추가로 SQL Editor에서 실행하세요)
--
-- 이렇게 해두면 프론트엔드에서 매번 user_id를 직접 넣지 않아도
-- "현재 로그인한 사용자"로 자동 채워져요. RLS 정책은 그대로
-- auth.uid() = user_id를 검사하니 보안은 동일하게 유지돼요.
-- ============================================================

alter table public.events alter column user_id set default auth.uid();
alter table public.event_overrides alter column user_id set default auth.uid();
alter table public.cell_decorations alter column user_id set default auth.uid();
