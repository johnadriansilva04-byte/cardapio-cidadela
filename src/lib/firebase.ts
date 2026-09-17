/**
 * Firebase configuration for Cloud Messaging (push notifications).
 *
 * The values below are **non-secret** — they identify the project, not an
 * individual user.  They can safely live in client-side code.
 *
 * To get them:
 *   1. Go to https://console.firebase.google.com → Project Settings → General
 *   2. Scroll to "Your apps" → Web app (add one if missing)
 *   3. Copy the `firebaseConfig` object
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

/** Returns true when all required Firebase env vars are present. */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId,
  );
}
