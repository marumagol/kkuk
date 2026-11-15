/*
  KKuK 휴대폰 푸시 (5단계 7번, migration 0023)
  - GET  : 푸시 공개 키를 돌려준다. 키가 없으면 여기서 처음 만들어 DB(private.push_keys)에 둔다
  - POST : 아직 안 보낸 알림을 가져가 기기마다 보낸다. DB 트리거가 새 알림마다 부른다
  누구나 부를 수 있지만(verify_jwt 끔) 할 수 있는 일은 "밀린 알림 보내기"뿐이고, 같은 알림은 한 번만 나간다
*/
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization, apikey" };

async function keys(): Promise<{ public: string; private: string }> {
  const { data } = await sb.rpc("push_keys");
  if (data) return data;
  const k = webpush.generateVAPIDKeys();
  const { data: saved, error } = await sb.rpc("push_keys", { p_public: k.publicKey, p_private: k.privateKey });
  if (error || !saved) throw new Error("keys_failed");
  return saved;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const k = await keys();
    if (req.method === "GET") return Response.json({ publicKey: k.public }, { headers: CORS });
    webpush.setVapidDetails("https://kkuk.vercel.app", k.public, k.private);
    const { data: rows, error } = await sb.rpc("push_take_pending");
    if (error) throw error;
    let sent = 0;
    await Promise.all((rows ?? []).map(async (r: { endpoint: string; p256dh: string; auth: string; title: string; body: string; url: string }) => {
      try {
        await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          JSON.stringify({ title: r.title, body: r.body, url: r.url }), { TTL: 3600 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await sb.rpc("push_drop", { p_endpoint: r.endpoint });
        else console.error("push_failed", code);
      }
    }));
    return Response.json({ sent }, { headers: CORS });
  } catch (e) {
    console.error("push_error", e);
    return Response.json({ error: "push_error" }, { status: 500, headers: CORS });
  }
});
