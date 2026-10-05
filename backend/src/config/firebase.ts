import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

// Lazy so the server can start without Firebase credentials;
// only Google login needs them.
const getFirebaseApp = (): App => {
  const existing = getApps()[0];
  if (existing) return existing;

  const encoded = process.env.FIREBASE_APPLICATION_CREDENTIALS;
  if (!encoded) {
    throw new Error("FIREBASE_APPLICATION_CREDENTIALS is not set");
  }

  const credentials = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");

  return initializeApp({ credential: cert(credentials) });
};

export const getFirebaseAuth = (): Auth => getAuth(getFirebaseApp());
