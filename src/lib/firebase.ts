
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
// import { getFirestore } from "firebase/firestore"; // Example, if you need Firestore
// import { getStorage } from "firebase/storage"; // Example, if you need Storage

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Determine execution environment for logging
const executionEnv = typeof window === 'undefined' ? 'SERVER' : 'CLIENT';

console.log(`[${executionEnv}] Firebase Initializing... Raw apiKey from env: '${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}'`);
console.log(`[${executionEnv}] Attempting to initialize Firebase with resolved config:`, JSON.stringify(firebaseConfig, null, 2));

if (!firebaseConfig.apiKey) {
  const errorMessage = `[${executionEnv}] CRITICAL Firebase Initialization Error: NEXT_PUBLIC_FIREBASE_API_KEY in the config is missing or undefined. ` +
    "This usually means it's not correctly set in your .env.local file OR the Next.js server was not restarted after changes. " +
    "Please verify that NEXT_PUBLIC_FIREBASE_API_KEY is correctly set in the .env.local file in your project root, " +
    "and that you have RESTARTED your Next.js development server (e.g., 'npm run dev') " +
    "after creating or modifying the .env.local file. " +
    "The resolved apiKey value was: '" + firebaseConfig.apiKey + "'";
  console.error(errorMessage);
  // If client-side, you might want to make this error more visible if console is missed
  // if (executionEnv === 'CLIENT') {
  //   alert(errorMessage); // Or throw new Error(errorMessage);
  // }
}

let app: FirebaseApp;
let auth: Auth;

try {
  if (!getApps().length) {
    console.log(`[${executionEnv}] No Firebase apps initialized. Initializing new app...`);
    app = initializeApp(firebaseConfig);
  } else {
    console.log(`[${executionEnv}] Existing Firebase app found. Getting app...`);
    app = getApp();
  }
  console.log(`[${executionEnv}] Firebase app object:`, app ? 'Exists' : 'Does NOT exist');
  
  auth = getAuth(app); // This is line 18 where the error was reported
  console.log(`[${executionEnv}] Firebase Auth initialized successfully.`);

} catch (error: any) {
  console.error(`[${executionEnv}] Firebase full initialization failed. Error:`, error.message);
  console.error(`[${executionEnv}] Firebase config used at time of error:`, JSON.stringify(firebaseConfig, null, 2));
  // To make errors more visible during development on the client
  if (executionEnv === 'CLIENT' && document.body) {
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '0';
    errorDiv.style.left = '0';
    errorDiv.style.width = '100%';
    errorDiv.style.padding = '10px';
    errorDiv.style.backgroundColor = 'red';
    errorDiv.style.color = 'white';
    errorDiv.style.zIndex = '9999';
    errorDiv.style.fontSize = '14px';
    errorDiv.innerText = `FIREBASE INIT ERROR (CLIENT): ${error.message}. Check browser console for details. Ensure .env.local is correct and server restarted.`;
    document.body.prepend(errorDiv);
  }
  // Re-throw the error to allow Next.js to handle it, or handle it more gracefully if needed for production
  // For now, let the original error propagate for Next.js's overlay
  // throw error;
}

// @ts-ignore - app and auth are initialized in the try block or should throw
export { app, auth };
