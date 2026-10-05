import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const googleProvider = new GoogleAuthProvider();

// Public pages and password login do not require Firebase configuration.
export const getGoogleAuth = () => {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error("Google sign-in is not configured.");
  }
  return getAuth(initializeApp(firebaseConfig));
};

export { googleProvider };
