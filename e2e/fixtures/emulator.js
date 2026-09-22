import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

// Même projet de démonstration que .firebaserc / .env.e2e : firebase-admin
// (utilisé ici pour peupler les émulateurs en contournant firestore.rules)
// et le SDK client de l'app doivent pointer sur le même projet pour voir
// les mêmes données dans l'émulateur Firestore.
export const PROJECT_ID = 'demo-find-my-company'
export const FIRESTORE_HOST = '127.0.0.1:8080'
export const AUTH_HOST = '127.0.0.1:9099'

export const ADMIN_EMAIL = 'admin.e2e@example.com'
export const ADMIN_PASSWORD = 'e2e-Test-Password-123!'

process.env.FIRESTORE_EMULATOR_HOST ??= FIRESTORE_HOST
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= AUTH_HOST

// firebase-admin refuse une deuxième initializeApp() sans nom : le global
// setup et chaque fichier de test important ce module doivent réutiliser la
// même instance plutôt que d'en recréer une.
function adminApp() {
  return getApps()[0] ?? initializeApp({ projectId: PROJECT_ID })
}

export function adminDb() {
  return getFirestore(adminApp())
}

export function adminAuth() {
  return getAuth(adminApp())
}

// Le webServer Playwright ne considère l'émulateur prêt que lorsque
// Firestore (seule URL surveillée, voir playwright.config.js) répond, mais
// Auth démarre dans le même process et peut finir d'ouvrir son port juste
// après : on retente donc ici plutôt que d'échouer sur un ECONNREFUSED
// transitoire au tout début du global-setup.
async function withRetry(fn, { attempts = 20, delayMs = 500 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === attempts) throw error
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

// Vide entièrement l'émulateur Firestore. Utilisé une seule fois en début
// de run (global-setup) : les specs s'exécutent en série (voir
// playwright.config.js) et seedent leurs propres données avec des noms
// suffisamment uniques pour ne pas interférer entre elles.
export async function clearFirestore() {
  const url = `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`
  const response = await withRetry(() => fetch(url, { method: 'DELETE' }))
  if (!response.ok) {
    throw new Error(`Impossible de vider l'émulateur Firestore : ${response.status} ${await response.text()}`)
  }
}

// Crée l'utilisateur admin de test s'il n'existe pas déjà (idempotent, pour
// pouvoir relancer le global-setup sans échouer sur "email already exists"),
// et son document admins/{uid} : c'est lui, et non le simple fait d'être
// connecté, qui donne les droits d'admin (voir firestore.rules). En prod, ce
// document est créé à la main depuis la console Firebase.
export async function ensureAdminUser() {
  const auth = adminAuth()
  const admin = await withRetry(async () => {
    const existing = await auth.getUserByEmail(ADMIN_EMAIL).catch(() => null)
    if (existing) return existing
    return auth.createUser({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  })
  await adminDb().collection('admins').doc(admin.uid).set({ role: 'admin' })
  return admin
}

// Marque un compte comme ayant vérifié son email, directement via l'admin
// SDK : c'est l'effet du clic sur le lien de vérification envoyé par
// Firebase (sendEmailVerification), sans avoir besoin de récupérer ce lien
// ni de simuler la page hébergée par Firebase qui l'applique — notre
// application ne fait rien de plus que lire ce champ une fois vérifié.
export async function markEmailVerified(email) {
  const auth = adminAuth()
  const user = await auth.getUserByEmail(email)
  await auth.updateUser(user.uid, { emailVerified: true })
}
