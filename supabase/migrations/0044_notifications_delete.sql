-- 읽은 알림 모두 삭제 (2026-11-17 마루님) : 내 알림 중 읽은 것만 지우는 함수
create or replace function public.delete_read_notifications()
returns integer language sql security definer set search_path = public as $$
  with d as (delete from public.notifications where user_id = auth.uid() and read_at is not null returning 1)
  select count(*)::integer from d;
$$;
revoke all on function public.delete_read_notifications() from public;
grant execute on function public.delete_read_notifications() to authenticated;
