
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Returns true when the value is absent, empty, or the literal string
 * "placeholder" that Cloud Build injects when a substitution var is not set
 * in the trigger. Guards against Firebase initialising with invalid credentials
 * that would cause every API call to return 400 auth/invalid-api-key.
 */
const isPlaceholder = (v: string | undefined): boolean =>
  !v || v === "placeholder" || v.startsWith("placeholder");

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (!isPlaceholder(process.env.NEXT_PUBLIC_FIREBASE_API_KEY)) {
  // Real credentials — initialise Firebase once across HMR reloads.
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} else {
  // Stub for SSR / build-time static generation, or when credentials are
  // missing / placeholder. Real usage is always in "use client" components,
  // so callers must check `auth` is valid before calling Firebase APIs.
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[firebase] Skipping initialisation — NEXT_PUBLIC_FIREBASE_API_KEY is missing or placeholder."
    );
  }
  app = {} as FirebaseApp;
  auth = {} as Auth;
  db = {} as Firestore;
  storage = {} as FirebaseStorage;
}

export { app, auth, db, storage };

