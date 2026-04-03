/**
 * Configuration Firebase et initialisation
 * Centralise la configuration de Firebase pour toute l'application
 */

import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseApiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim() || ''

// Configuration Firebase du projet
const firebaseConfig = {
  apiKey: firebaseApiKey,
  authDomain: "find-my-company-30652.firebaseapp.com",
  projectId: "find-my-company-30652",
  storageBucket: "find-my-company-30652.firebasestorage.app",
  messagingSenderId: "563118719650",
  appId: "1:563118719650:web:ebaaf3d949d66323168dfb",
  measurementId: "G-LYWPQXCMYB"
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Obtenir la référence à Firestore
const db = getFirestore(app);
let auth = null

if (!firebaseApiKey) {
  console.warn('Firebase Auth desactive: VITE_FIREBASE_API_KEY est manquante.')
} else {
  try {
    auth = getAuth(app)
  } catch (error) {
    console.error('Impossible d\'initialiser Firebase Auth:', error)
    auth = null
  }
}

// Exporter la base de données pour utilisation dans les services
export { db, auth };
