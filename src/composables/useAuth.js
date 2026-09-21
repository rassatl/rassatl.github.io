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

// Où ramener l'étudiant une fois son email vérifié : la fiche d'une
// entreprise (dont il voulait voir les contacts) ou, à défaut, le formulaire
// d'ajout. Gardé au même endroit que l'adresse, avec les mêmes limites : perdu
// si le lien est ouvert sur un autre appareil.
const RETURN_TO_KEY = 'studentSignInReturnTo'

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

// Les contacts d'une entreprise ne sont montrés qu'aux étudiants vérifiés et
// aux admins (firestore.rules l'impose aussi : ce n'est pas qu'un affichage).
const canViewContacts = computed(() => state.isAdmin || !!studentEmail.value)

export function useAuth() {
  const login = (email, password) => signInWithEmailAndPassword(auth, email, password)
  const logout = () => signOut(auth)

  // Envoie à l'email étudiant un lien qui, ouvert, prouve que la personne
  // possède bien cette boîte mail. `returnTo` ({ companyId }) indique la fiche
  // à rouvrir au retour ; sans lui, c'est le formulaire d'ajout.
  const sendStudentLink = async (email, returnTo = null) => {
    const address = email.trim()
    if (!isStudentEmail(address)) throw new Error('Not a student email address')
    await sendSignInLinkToEmail(auth, address, {
      url: `${window.location.origin}${window.location.pathname}`,
      handleCodeInApp: true
    })
    localStorage.setItem(PENDING_EMAIL_KEY, address)
    if (returnTo) localStorage.setItem(RETURN_TO_KEY, JSON.stringify(returnTo))
    else localStorage.removeItem(RETURN_TO_KEY)
  }

  // À appeler au chargement de la page : si l'URL est un lien de vérification
  // reçu par email, connecte l'étudiant et nettoie l'URL. Renvoie null si
  // l'URL n'en est pas un ; sinon { returnTo, error } : `returnTo` est la fiche
  // à rouvrir (ou null pour le formulaire d'ajout), `error` l'erreur Firebase
  // si le lien est invalide ou expiré (null en cas de succès).
  // `askEmail` sert quand le lien est ouvert sur un autre appareil que celui
  // qui l'a demandé : l'adresse n'est alors pas en mémoire.
  const completeStudentSignIn = async (askEmail) => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return null
    let returnTo = null
    try {
      returnTo = JSON.parse(localStorage.getItem(RETURN_TO_KEY) ?? 'null')
    } catch {
      returnTo = null
    }
    try {
      const address = localStorage.getItem(PENDING_EMAIL_KEY) || askEmail?.()
      if (address) {
        await signInWithEmailLink(auth, address.trim(), window.location.href)
        localStorage.removeItem(PENDING_EMAIL_KEY)
      }
      return { returnTo, error: null }
    } catch (error) {
      return { returnTo, error }
    } finally {
      localStorage.removeItem(RETURN_TO_KEY)
      // Le lien est à usage unique : le laisser dans l'URL n'aurait aucun sens
      // (et un rechargement retenterait une connexion vouée à l'échec).
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }

  return {
    user: computed(() => state.user),
    isAdmin: computed(() => state.isAdmin),
    studentEmail,
    canViewContacts,
    login,
    logout,
    sendStudentLink,
    completeStudentSignIn
  }
}
