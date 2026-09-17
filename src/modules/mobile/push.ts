/**
 * Push notification subscription manager.
 *
 * Uses Firebase Cloud Messaging (FCM) to register the device for web push.
 * The service worker (public/sw.js) receives push events and shows system
 * notifications — even when the app is closed or the browser is minimized.
 *
 * Flow:
 *   1. User enables notifications in settings
 *   2. This module requests permission → gets an FCM token
 *   3. The token (device endpoint) is stored in Supabase `push_subscriptions`
 *   4. When a new order arrives, a Supabase Edge Function sends a push to
 *      all stored tokens via Firebase Admin SDK
 *   5. The service worker receives the push and shows a notification
 */

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  type Messaging,
} from "firebase/messaging";
import { isFirebaseConfigured, firebaseConfig } from "@/lib/firebase";
import { supabase } from "@/modules/supabase/client";

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

function getFirebaseMessaging(): Messaging | null {
  if (messaging) return messaging;
  if (!isFirebaseConfigured()) return null;
  try {
    app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
    return messaging;
  } catch (e) {
    console.warn("[push] Firebase init failed", e);
    return null;
  }
}

/** VAPID key for web push (from Firebase Console → Cloud Messaging → Web push) */
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;

/**
 * Subscribe the current device for push notifications.
 * Returns the FCM token on success, null on failure.
 */
export async function subscribePush(): Promise<string | null> {
  const mg = getFirebaseMessaging();
  if (!mg) {
    console.warn("[push] Firebase Messaging not available");
    return null;
  }
  if (!VAPID_KEY) {
    console.warn("[push] VITE_FIREBASE_VAPID_KEY not set");
    return null;
  }

  try {
    const token = await getToken(mg, { vapidKey: VAPID_KEY });
    if (token) {
      await saveTokenToSupabase(token);
      return token;
    }
    return null;
  } catch (e) {
    console.error("[push] getToken failed", e);
    return null;
  }
}

/**
 * Check if there's already an active push subscription.
 * Returns the existing token if the service worker has one.
 */
export async function getExistingToken(): Promise<string | null> {
  const mg = getFirebaseMessaging();
  if (!mg) return null;

  try {
    const token = await getToken(mg);
    return token || null;
  } catch {
    return null;
  }
}

/** Store the FCM token in Supabase so the Edge Function can send to it. */
async function saveTokenToSupabase(token: string): Promise<void> {
  try {
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

    // Upsert subscription for each restaurant
    for (const r of restaurants) {
      await supabase.from("push_subscriptions").upsert(
        {
          restaurant_id: r.id,
          user_id: user.id,
          token,
          platform: detectPlatform(),
          created_at: new Date().toISOString(),
        },
        { onConflict: "token,restaurant_id" },
      );
    }
  } catch (e) {
    console.error("[push] saveToken failed", e);
  }
}

/** Remove the current device's push subscription. */
export async function unsubscribePush(): Promise<void> {
  try {
    const mg = getFirebaseMessaging();
    if (mg) {
      const token = await getToken(mg);
      if (token) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("token", token);
      }
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
