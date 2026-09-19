/**
 * Supabase Edge Function: notify-new-order
 *
 * Recebe o payload do pedido (chamada fire-and-forget do createOrder)
 * e envia Web Push para todos os dispositivos do restaurante — via
 * protocolo nativo Web Push (RFC 8291 + VAPID RFC 8292), sem Firebase
 * e sem nenhuma variável de ambiente para configurar.
 *
 * A chave VAPID é gerada automaticamente na primeira execução e
 * persistida na tabela `push_vapid` (criada no schema.sql). O mesmo
 * par de chaves assina o push do servidor e valida a subscription do
 * cliente — zero setup.
 *
 * Deploy (uma vez):
 *   supabase functions deploy notify-new-order
 *
 * O cliente lê a chave pública via Edge Function `push-vapid-key`
 * (mesma pasta, sem segredos).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { webpush } from "npm:web-push@3.6.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ─── VAPID: gera na primeira execução e persiste em push_vapid ──
let vapidCache: { publicKey: string; privateKey: string } | null = null;

async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string } | null> {
  if (vapidCache) return vapidCache;

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await admin.from("push_vapid").select("*").limit(1).maybeSingle();
  if (error) {
    console.error("[push] push_vapid read failed:", error.message);
    return null;
  }

  if (data?.public_key && data?.private_key) {
    vapidCache = { publicKey: data.public_key, privateKey: data.private_key };
    return vapidCache;
  }

  // Primeira execução: gera o par P-256 (padrão Web Push) e salva.
  const generated = webpush.generateVAPIDKeys();
  const { error: insertError } = await admin
    .from("push_vapid")
    .insert({ public_key: generated.publicKey, private_key: generated.privateKey });
  if (insertError) {
    // Corrida entre duas chamadas: tenta ler de novo.
    const { data: retry } = await admin.from("push_vapid").select("*").limit(1).maybeSingle();
    if (retry?.public_key && retry?.private_key) {
      vapidCache = { publicKey: retry.public_key, privateKey: retry.private_key };
      return vapidCache;
    }
    console.error("[push] push_vapid insert failed:", insertError.message);
    return null;
  }

  vapidCache = { publicKey: generated.publicKey, privateKey: generated.privateKey };
  return vapidCache;
}

/** Envia a notificação para uma subscription, removendo se estiver inválida. */
async function sendToSubscription(
  admin: ReturnType<typeof createClient>,
  sub: { token: string; p256dh: string; auth: string; id?: string },
  payload: string,
  vapid: { publicKey: string; privateKey: string },
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.token,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
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
    // 404/410 = subscription expirada ou revogada → remove do banco.
    if (status === 404 || status === 410) {
      await admin.from("push_subscriptions").delete().eq("token", sub.token);
    }
    console.warn("[push] send failed:", status ?? e);
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
    const order = await req.json();
    const restaurantId = order?.restaurant_id;
    if (!restaurantId) {
      return new Response("Missing restaurant_id", { status: 400 });
    }

    const vapid = await getVapidKeys();
    if (!vapid) {
      return new Response(JSON.stringify({ error: "vapid unavailable" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: subscriptions, error } = await admin
      .from("push_subscriptions")
      .select("token, p256dh, auth")
      .eq("restaurant_id", restaurantId);

    if (error) {
      console.error("[push] subscriptions read failed:", error.message);
      return new Response("Database error", { status: 500 });
    }
    if (!subscriptions?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const itemCount = Array.isArray(order.items) ? order.items.length : 0;
    const title = "🔔 Novo Pedido!";
    const body = `${order.customer_name ?? "Cliente"} — ${itemCount} item${itemCount === 1 ? "" : "s"} • R$ ${Number(order.total ?? 0).toFixed(2).replace(".", ",")}`;

    const payload = JSON.stringify({
      title,
      body,
      url: "/mobile",
      orderId: order.id,
      tag: "cidadela-order",
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
    console.error("[push] fatal:", e);
    return new Response("Internal error", { status: 500 });
  }
});
