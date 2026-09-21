import { reactive, computed } from 'vue'
import { auth, db } from '../services/firebase'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { isStudentEmail } from '../utils/studentEmail.js'

// Adresse à laquelle le lien de vérification a été envoyé, gardée le temps
// que l'étudiant ouvre son email : le lien ne contient pas l'adresse, il
// faut la redonner à Firebase pour finaliser la connexion (voir
// completeStudentSignIn).
const PENDING_EMAIL_KEY = 'studentEmailForSignIn'

const state = reactive({
  user: null,
  isAdmin: false
})

// Deux types de comptes Firebase Auth coexistent : les administrateurs
// (email + mot de passe) et les étudiants (lien envoyé à leur email
// étudiant). Être authentifié ne suffit donc plus à être admin : il faut un
// document admins/{uid}, créé à la main depuis la console Firebase (voir
// firestore.rules, qui fait foi ; ce contrôle ne sert qu'à afficher l'UI).
onAuthStateChanged(auth, async (firebaseUser) => {
  state.user = firebaseUser
  state.isAdmin = false
  if (!firebaseUser) return
  try {
    const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid))
    // L'utilisateur a pu changer pendant l'aller-retour réseau.
    if (state.user?.uid === firebaseUser.uid) state.isAdmin = adminDoc.exists()
  } catch (e) {
    console.error('Erreur lors de la vérification du compte administrateur :', e)
  }
})

// Un étudiant vérifié est un compte dont l'email étudiant a été confirmé par
// le lien de connexion (emailVerified reste faux pour un compte créé sans ce
// lien) et qui n'est pas admin.
const studentEmail = computed(() => {
  const user = state.user
  if (!user || state.isAdmin || !user.emailVerified || !isStudentEmail(user.email)) return null
  return user.email
})

export function useAuth() {
  const login = (email, password) => signInWithEmailAndPassword(auth, email, password)
  const logout = () => signOut(auth)

  // Envoie à l'email étudiant un lien qui, ouvert, prouve que la personne
  // possède bien cette boîte mail.
  const sendStudentLink = async (email) => {
    const address = email.trim()
    if (!isStudentEmail(address)) throw new Error('Not a student email address')
    await sendSignInLinkToEmail(auth, address, {
      url: `${window.location.origin}${window.location.pathname}`,
      handleCodeInApp: true
    })
    localStorage.setItem(PENDING_EMAIL_KEY, address)
  }

  // À appeler au chargement de la page : si l'URL est un lien de vérification
  // reçu par email, connecte l'étudiant et nettoie l'URL. Renvoie true si
  // l'URL en était un (succès ou non), pour que l'appelant puisse rouvrir le
  // formulaire ; lève l'erreur Firebase si le lien est invalide ou expiré.
  // `askEmail` sert quand le lien est ouvert sur un autre appareil que celui
  // qui l'a demandé : l'adresse n'est alors pas en mémoire.
  const completeStudentSignIn = async (askEmail) => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return false
    try {
      const address = localStorage.getItem(PENDING_EMAIL_KEY) || askEmail?.()
      if (!address) return true
      await signInWithEmailLink(auth, address.trim(), window.location.href)
      localStorage.removeItem(PENDING_EMAIL_KEY)
      return true
    } finally {
      // Le lien est à usage unique : le laisser dans l'URL n'aurait aucun sens
      // (et un rechargement retenterait une connexion vouée à l'échec).
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }

  return {
    user: computed(() => state.user),
    isAdmin: computed(() => state.isAdmin),
    studentEmail,
    login,
    logout,
    sendStudentLink,
    completeStudentSignIn
  }
}
