-- ============================================================
-- Bboggl · 공휴일 자동 표시 기능을 위한 스키마 보완
-- ============================================================

alter table public.events add column is_holiday boolean not null default false;
create index idx_events_holiday on public.events(user_id, is_holiday);
