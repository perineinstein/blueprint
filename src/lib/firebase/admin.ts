import { initializeApp, getApps, App, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not configured."
    );
  }

  let serviceAccount: unknown;

  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON contains invalid JSON."
    );
  }

  return initializeApp({
    credential: cert(
      serviceAccount as Parameters<typeof cert>[0]
    ),
    storageBucket: "blueprint-lms.firebasestorage.app",
  });
}

const adminApp = getAdminApp();

export const adminDb = getFirestore(adminApp);
// Do NOT add adminAuth / firebase-admin/auth here. It pulls in jwks-rsa -> jose
// (ESM-only), which breaks every route importing this file on Vercel/Turbopack.
// Verify tokens with the REST API in verifyAuth.ts instead.
export const adminStorage = getStorage(adminApp);

export default adminApp;