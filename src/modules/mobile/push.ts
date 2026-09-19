/**
 * Push notification subscription manager — Web Push nativo do navegador.
 *
 * Não usa Firebase nem nenhuma variável de ambiente: a chave VAPID fica
 * no banco (settings da Edge Function) e o cliente só precisa do
 * applicationServerKey, lido da própria subscription/endpoint público.
 *
 * Fluxo:
 *   1. Usuário ativa notificações (banner no /mobile ou em Config).
 *   2. Este módulo pede permissão → gera a subscription Web Push
 *      (endpoint + p256dh + auth) e salva em `push_subscriptions`.
 *   3. Trigger no banco (schema.sql) chama a Edge Function a cada pedido.
 *   4. Edge Function cifra e envia via protocolo Web Push (RFC 8291).
 *   5. Service worker (/sw.js) mostra a notificação — mesmo com o app fechado.
 */

import { supabase } from "@/modules/supabase/client";

/** Chave pública VAPID lida da Edge Function (mesma do lado servidor). */
export async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("push-vapid-key");
    if (error || !data?.publicKey) return null;
    return data.publicKey as string;
  } catch {
    return null;
  }
}

/**
 * Subscribe the current device for push notifications.
 * Returns the endpoint URL on success, null on failure.
 */
export async function subscribePush(): Promise<string | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  if (!("PushManager" in window)) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    const vapidPublicKey = await fetchVapidPublicKey();
    if (!vapidPublicKey) {
      console.warn("[push] chave VAPID indisponível (Edge Function push-vapid-key)");
      return null;
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    await saveSubscriptionToSupabase(subscription);
    return subscription.endpoint;
  } catch (e) {
    console.error("[push] subscribe failed", e);
    return null;
  }
}

/**
 * Check if there's already an active push subscription.
 */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/** Store the subscription in Supabase so the Edge Function can send to it. */
async function saveSubscriptionToSupabase(subscription: PushSubscription): Promise<void> {
  try {
    const json = subscription.toJSON();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Get the user's restaurants
    const { data: restaurants } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id);

    if (!restaurants || restaurants.length === 0) return;

    const token = json.endpoint ?? "";
    const keys = (json.keys ?? {}) as { p256dh?: string; auth?: string };

    // Upsert subscription for each restaurant
    for (const r of restaurants) {
      await supabase.from("push_subscriptions").upsert(
        {
          restaurant_id: r.id,
          user_id: user.id,
          token,
          p256dh: keys.p256dh ?? "",
          auth: keys.auth ?? "",
          platform: detectPlatform(),
        },
        { onConflict: "token,restaurant_id" },
      );
    }
  } catch (e) {
    console.error("[push] saveSubscription failed", e);
  }
}

/** Remove the current device's push subscription. */
export async function unsubscribePush(): Promise<void> {
  try {
    const subscription = await getExistingSubscription();
    if (subscription) {
      await supabase.from("push_subscriptions").delete().eq("token", subscription.endpoint);
      await subscription.unsubscribe();
    }
  } catch (e) {
    console.error("[push] unsubscribe failed", e);
  }
}

function detectPlatform(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  return "web";
}

/** RFC 8292: applicationServerKey chega em base64url. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}
