/**
 * Supabase Edge Function: push-vapid-key
 *
 * Expõe a chave PÚBLICA VAPID para o cliente gerar as subscriptions.
 * Sem segredos — a chave privada nunca sai do banco.
 *
 * Deploy: supabase functions deploy push-vapid-key
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await admin.from("push_vapid").select("public_key").limit(1).maybeSingle();

    if (error || !data?.public_key) {
      // Ainda não existe: gera agora (idempotente — a função de envio
      // reutiliza a mesma linha).
      const { webpush } = await import("npm:web-push@3.6.7");
      const keys = webpush.generateVAPIDKeys();
      const { error: insertError } = await admin
        .from("push_vapid")
        .insert({ public_key: keys.publicKey, private_key: keys.privateKey });
      if (insertError) {
        const { data: retry } = await admin
          .from("push_vapid")
          .select("public_key")
          .limit(1)
          .maybeSingle();
        if (retry?.public_key) {
          return json({ publicKey: retry.public_key });
        }
        return json({ error: "vapid unavailable" }, 500);
      }
      return json({ publicKey: keys.publicKey });
    }

    return json({ publicKey: data.public_key });
  } catch (e) {
    console.error("[push-vapid-key]", e);
    return json({ error: "internal" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
