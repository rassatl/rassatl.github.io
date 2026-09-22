import { adminAuth, adminDb, AUTH_HOST, FIRESTORE_HOST, PROJECT_ID } from './emulator.js'

const PASSWORD = 'e2e-Rules-Password-123!'

// Crée (si besoin) un compte dans l'émulateur Auth, avec le statut de
// vérification d'email voulu, et renvoie un vrai jeton d'identité : celui
// qu'aurait le client après connexion. Sert à tester firestore.rules sans
// passer par l'interface, en attaquant directement l'API comme le ferait
// quelqu'un qui contourne le formulaire.
//
// emailVerified ne pilote plus le champ Auth natif (email_verified, qu'on
// n'utilise plus dans isStudent(), voir firestore.rules) mais le document
// studentAccounts/{uid} : c'est lui qui fait foi désormais (voir useAuth.js).
export async function idTokenFor(email, { emailVerified = false, password = PASSWORD } = {}) {
  const auth = adminAuth()
  const existing = await auth.getUserByEmail(email).catch(() => null)
  const user = existing ?? await auth.createUser({ email, password })
  if (emailVerified) {
    await adminDb().collection('studentAccounts').doc(user.uid).set({ email, emailVerified: true }, { merge: true })
  }

  const response = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  )
  const { idToken, localId } = await response.json()
  return { idToken, uid: localId }
}

const toValue = (value) => {
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  return { doubleValue: value }
}

const toFields = (data) => Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toValue(value)]))

const headers = (idToken) => ({
  'Content-Type': 'application/json',
  ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
})

const documentsUrl = (path) => `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`

// Crée un document via l'API REST de Firestore avec les droits de ce jeton
// (aucun jeton = visiteur anonyme). Renvoie le statut HTTP (200 accepté,
// 403 refusé par les règles) et l'identifiant du document créé.
export async function createDocument(idToken, path, data) {
  const response = await fetch(documentsUrl(path), {
    method: 'POST',
    headers: headers(idToken),
    body: JSON.stringify({ fields: toFields(data) }),
  })
  const body = await response.json()
  return { status: response.status, id: body.name?.split('/').pop() }
}

// Lit une collection entière via l'API REST, avec les droits de ce jeton.
export async function listDocuments(idToken, path) {
  const response = await fetch(documentsUrl(path), { headers: headers(idToken) })
  return response.status
}

// Lit un document précis (par son chemin complet) avec les droits de ce jeton.
export async function getDocument(idToken, path) {
  const response = await fetch(documentsUrl(path), { headers: headers(idToken) })
  return response.status
}
