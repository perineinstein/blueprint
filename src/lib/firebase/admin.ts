import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];

  // Production: use full JSON in one env var
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    );
    return initializeApp({
      credential: cert(serviceAccount),
      storageBucket: "blueprint-lms.firebasestorage.app",
    });
  }

  // Local dev: read from file
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const serviceAccountFile = require("../../../service-account.json");
  return initializeApp({
    credential: cert(serviceAccountFile),
    storageBucket: "blueprint-lms.firebasestorage.app",
  });
}

const adminApp = getAdminApp();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);