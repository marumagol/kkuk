/*
  KKuK 삭제한 지 30일 지난 여행 완전 삭제 (6단계 5번, migration 0028)
  - 매일 03:00 pg_cron 이 부른다. 대상은 DB 함수 purge_candidates() 가 정한 여행뿐
  - 여행마다 사진 파일(place-photos/<여행 id>/ 와 /j/)을 먼저 지우고, purge_trip() 으로 행을 지운다
  누구나 부를 수 있지만(verify_jwt 끔) 30일 지난 삭제 여행만 지운다
*/
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

async function filesUnder(prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await sb.storage.from("place-photos").list(prefix, { limit: 100, offset });
    if (error || !data?.length) break;
    for (const f of data) {
      if (f.id) out.push(`${prefix}/${f.name}`);
      else out.push(...(await filesUnder(`${prefix}/${f.name}`))); // 폴더 (예 : j)
    }
    if (data.length < 100) break;
  }
  return out;
}

Deno.serve(async () => {
  try {
    const { data: ids, error } = await sb.rpc("purge_candidates");
    if (error) throw error;
    let trips = 0, files = 0;
    for (const id of (ids ?? []) as string[]) {
      const paths = await filesUnder(id);
      for (let i = 0; i < paths.length; i += 100) {
        const { error: e } = await sb.storage.from("place-photos").remove(paths.slice(i, i + 100));
        if (e) throw e;
      }
      files += paths.length;
      const { data: ok } = await sb.rpc("purge_trip", { p_trip: id });
      if (ok) trips++;
    }
    console.log("purged", trips, files);
    return Response.json({ trips, files });
  } catch (e) {
    console.error("purge_error", e);
    return Response.json({ error: "purge_error" }, { status: 500 });
  }
});
