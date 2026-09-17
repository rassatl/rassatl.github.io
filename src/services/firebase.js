// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "find-my-company-30652.firebaseapp.com",
  // Surchargé en mode e2e (voir .env.e2e) pour pointer vers un projet de
  // démonstration dédié aux émulateurs Firestore/Auth (voir playwright.config.js).
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "find-my-company-30652",
  storageBucket: "find-my-company-30652.firebasestorage.app",
  messagingSenderId: "563118719650",
  appId: "1:563118719650:web:ebaaf3d949d66323168dfb",
  measurementId: "G-LYWPQXCMYB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app)
const auth = getAuth(app)

// Utilisé uniquement par les tests Playwright (voir .env.e2e) : redirige le
// SDK client vers les émulateurs locaux au lieu du vrai projet Firebase.
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
}

export { db, auth }
