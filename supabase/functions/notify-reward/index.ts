/**
 * Supabase Edge Function: notify-reward
 *
 * Avisa o dono que a loja bateu uma meta e ganhou PEDIDOS BÔNUS na cota.
 * Chamada pelo cron (`evaluate_rewards` → `notify_reward_push` via pg_net)
 * quando uma recompensa é concedida.
 *
 * Reaproveita o mesmo Web Push nativo (VAPID + RFC 8291) da `notify-new-order`
 * — sem Firebase e sem variável de ambiente própria: a chave VAPID vive em
 * `push_vapid` e é gerada na primeira execução.
 *
 * Deploy (uma vez):
 *   supabase functions deploy notify-reward
 *
 * Endpoint público (a chave anon vai no bundle), então validamos que o
 * restaurante informado realmente existe antes de disparar qualquer push.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { webpush } from "npm:web-push@3.6.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

let vapidCache: { publicKey: string; privateKey: string } | null = null;

async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string } | null> {
  if (vapidCache) return vapidCache;
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin.from("push_vapid").select("*").limit(1).maybeSingle();
  if (error) {
    console.error("[push/reward] push_vapid read failed:", error.message);
    return null;
  }
  if (data?.public_key && data?.private_key) {
    vapidCache = { publicKey: data.public_key, privateKey: data.private_key };
    return vapidCache;
  }
  const generated = webpush.generateVAPIDKeys();
  const { error: insertError } = await admin
    .from("push_vapid")
    .insert({ public_key: generated.publicKey, private_key: generated.privateKey });
  if (insertError) {
    const { data: retry } = await admin.from("push_vapid").select("*").limit(1).maybeSingle();
    if (retry?.public_key && retry?.private_key) {
      vapidCache = { publicKey: retry.public_key, privateKey: retry.private_key };
      return vapidCache;
    }
    console.error("[push/reward] push_vapid insert failed:", insertError.message);
    return null;
  }
  vapidCache = { publicKey: generated.publicKey, privateKey: generated.privateKey };
  return vapidCache;
}

async function sendToSubscription(
  admin: ReturnType<typeof createClient>,
  sub: { token: string; p256dh: string; auth: string },
  payload: string,
  vapid: { publicKey: string; privateKey: string },
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.token, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
      {
        vapidDetails: {
          subject: "mailto:push@cidadela.app",
          publicKey: vapid.publicKey,
          privateKey: vapid.privateKey,
        },
        TTL: 86400,
      },
    );
    return true;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await admin.from("push_subscriptions").delete().eq("token", sub.token);
    }
    console.warn("[push/reward] send failed:", status ?? e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const restaurantId = String(body?.restaurant_id ?? "");
    if (!restaurantId) {
      return new Response(JSON.stringify({ error: "missing restaurant_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Endpoint público: confirma que o restaurante existe antes de disparar.
    const { data: store } = await admin
      .from("restaurants")
      .select("id")
      .eq("id", restaurantId)
      .maybeSingle();
    if (!store) {
      return new Response(JSON.stringify({ error: "restaurant not found" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const vapid = await getVapidKeys();
    if (!vapid) {
      return new Response(JSON.stringify({ error: "vapid unavailable" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: subscriptions, error } = await admin
      .from("push_subscriptions")
      .select("token, p256dh, auth")
      .eq("restaurant_id", restaurantId);
    if (error) {
      console.error("[push/reward] subscriptions read failed:", error.message);
      return new Response("Database error", { status: 500 });
    }
    if (!subscriptions?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const title = String(body?.title ?? "Meta batida!");
    const bonus = Number(body?.bonus_orders ?? 0);
    const payload = JSON.stringify({
      title: "🎉 Recompensa conquistada!",
      body: `${title} — você ganhou +${bonus} pedido${bonus === 1 ? "" : "s"} na cota do mês.`,
      url: "/mobile",
      tag: "cidadela-reward",
    });

    let sent = 0;
    for (const sub of subscriptions) {
      const ok = await sendToSubscription(admin, sub, payload, vapid);
      if (ok) sent++;
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[push/reward] fatal:", e);
    return new Response("Internal error", { status: 500 });
  }
});
