-- ============================================================
-- Bboggl · "이 달만" 반복 일정 지원
-- 기존 제약(chk_type_fields)은 반복 일정에 event_date를 못 넣게 막습니다.
-- "이 달만" 반복 일정은 그 달의 1일을 event_date에 넣어 "이 달 한정"임을 표시하므로,
-- 반복 일정도 event_date를 가질 수 있게 제약을 완화합니다.
-- (특별 일정 규칙은 그대로 — 반드시 event_date가 있고 days_of_week는 없어야 함)
-- Supabase SQL Editor에서 이 파일 내용을 한 번 실행하세요.
-- ============================================================

alter table public.events drop constraint if exists chk_type_fields;

alter table public.events add constraint chk_type_fields check (
  (type = 'recurring' and days_of_week is not null)
  or
  (type = 'special' and event_date is not null and days_of_week is null)
);
