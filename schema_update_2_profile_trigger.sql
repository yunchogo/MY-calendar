-- ============================================================
-- Bboggl · 프로필 자동생성 트리거 재설치 + 기존 계정 백필
-- (schema.sql 최초 실행 시 "relation already exists" 에러로 중단되어
--  트리거 생성 구문까지 도달하지 못했던 것으로 보임)
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, calendar_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', '나의 캘린더'))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 이미 가입되어 있는데 profiles 행이 없는 계정 백필
insert into public.profiles (id, calendar_name)
select u.id, coalesce(u.raw_user_meta_data->>'name', '나의 캘린더')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
