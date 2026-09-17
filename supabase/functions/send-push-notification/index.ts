/**
 * Supabase Edge Function: send-push-notification
 *
 * Triggered by a database webhook on INSERT to the `orders` table.
 * Sends a Firebase Cloud Messaging push notification to all devices
 * subscribed to the restaurant.
 *
 * Environment variables required:
 *   FIREBASE_PROJECT_ID   — Firebase project ID
 *   FIREBASE_CLIENT_EMAIL — Firebase service account client email
 *   FIREBASE_PRIVATE_KEY  — Firebase service account private key (PEM)
 *
 * Deploy:
 *   supabase functions deploy send-push-notification
 *
 * Webhook (Supabase Dashboard → Database → Webhooks):
 *   Table: orders
 *   Events: INSERT
 *   Type: HTTP Request
 *   URL: https://<project-ref>.supabase.co/functions/v1/send-push-notification
 *   Method: POST
 *   Headers: Authorization: Bearer <anon-key>
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Firebase Admin SDK for sending push notifications
// We use the HTTP v1 API directly to avoid needing the full admin SDK in Deno

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "";
const FIREBASE_CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL") || "";
const FIREBASE_PRIVATE_KEY = (Deno.env.get("FIREBASE_PRIVATE_KEY") || "").replace(/\\n/g, "\n");

interface OrderPayload {
  id: string;
  restaurant_id: string;
  comanda: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  delivery_type: string;
  items?: { product_name: string; quantity: number }[];
}

/** Get a Firebase OAuth2 access token using the service account. */
async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  // JWT header
  const header = { alg: "RS256", typ: "JWT" };
  // JWT claim set
  const claimSet = {
    iss: FIREBASE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: expiry,
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedClaimSet = btoa(JSON.stringify(claimSet)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const unsignedJwt = `${encodedHeader}.${encodedClaimSet}`;

  // Import the private key for signing
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = FIREBASE_PRIVATE_KEY
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsignedJwt));
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsignedJwt}.${encodedSignature}`;

  // Exchange JWT for access token
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await resp.json();
  return data.access_token;
}

/** Send a push notification to a single FCM token. */
async function sendPush(
  accessToken: string,
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<boolean> {
  const message = {
    token,
    notification: { title, body },
    data,
    android: {
      priority: "high" as const,
      notification: {
        channel_id: "cidadela_orders",
        sound: "default",
      },
    },
    webpush: {
      headers: { TTL: "86400" },
      notification: {
        title,
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        vibrate: [200, 100, 200],
        actions: [{ action: "open", title: "Ver pedido" }],
      },
    },
  };

  const resp = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    },
  );

  if (!resp.ok) {
    const error = await resp.text();
    console.error(`[push] Failed to send to ${token.slice(0, 20)}...:`, error);
    // If the token is invalid, remove it
    if (resp.status === 404 || resp.status === 400) {
      return false;
    }
  }
  return resp.ok;
}

serve(async (req) => {
  try {
    // Only accept POST
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Verify the request has proper authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Parse the webhook payload
    const payload: OrderPayload = await req.json();
    const { restaurant_id, customer_name, comanda, total, items } = payload;

    if (!restaurant_id) {
      return new Response("Missing restaurant_id", { status: 400 });
    }

    // Initialize Supabase client to fetch subscriptions
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all push subscriptions for this restaurant
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("token, platform")
      .eq("restaurant_id", restaurant_id);

    if (subError) {
      console.error("[push] Failed to fetch subscriptions:", subError);
      return new Response("Database error", { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: "No subscribers", sent: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build notification content
    const itemCount = items?.length ?? 0;
    const title = "🔔 Novo Pedido!";
    const body = `${customer_name} — ${itemCount} item${itemCount !== 1 ? "s" : ""} • R$ ${(Number(total) || 0).toFixed(2).replace(".", ",")}`;
    const data: Record<string, string> = {
      url: "/mobile",
      orderId: payload.id,
      tag: "cidadela-order",
    };

    // Get Firebase access token
    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
      console.error("[push] Firebase credentials not configured");
      return new Response("Firebase not configured", { status: 500 });
    }

    const accessToken = await getAccessToken();

    // Send to all subscribers
    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];

    for (const sub of subscriptions) {
      const success = await sendPush(accessToken, sub.token, title, body, data);
      if (success) {
        sent++;
      } else {
        failed++;
        invalidTokens.push(sub.token);
      }
    }

    // Clean up invalid tokens
    if (invalidTokens.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("token", invalidTokens);
    }

    return new Response(
      JSON.stringify({ message: "Push notifications sent", sent, failed, total: subscriptions.length }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[push] Error:", e);
    return new Response("Internal error", { status: 500 });
  }
});
