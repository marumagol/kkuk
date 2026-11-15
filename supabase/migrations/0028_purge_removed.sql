/*
  0028 삭제한 지 30일 지난 여행 완전 삭제 (6단계 5번, 2026-11-15)
  - 매일 03:00(한국 시간) pg_cron 이 Edge Function "purge" 를 부른다
  - purge 함수가 대상 여행의 사진 파일(place-photos/<여행 id>/...)을 지우고 purge_trip() 으로 행을 지운다 (연결된 표는 cascade)
  - 대상은 removed_at 이 30일보다 오래된 여행뿐. 누가 함수를 불러도 그 이상은 지우지 않는다
  - 아래 public 함수 둘은 service_role(=Edge Function) 만 부를 수 있다
*/
create extension if not exists pg_cron;

create function public.purge_candidates() returns setof uuid
language sql stable security definer set search_path = ''
as $$ select id from public.trips where removed_at < now() - interval '30 days' order by removed_at limit 50 $$;

create function public.purge_trip(p_trip uuid) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.trips where id = p_trip and removed_at < now() - interval '30 days';
  return found;
end $$;

revoke all on function public.purge_candidates(), public.purge_trip(uuid) from public, anon, authenticated;
grant execute on function public.purge_candidates(), public.purge_trip(uuid) to service_role;

select cron.schedule('kkuk-purge-removed-trips', '0 18 * * *',
  $c$ select net.http_post(url := 'https://ruayolopyrivcscraysf.supabase.co/functions/v1/purge', body := '{}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb) $c$);
