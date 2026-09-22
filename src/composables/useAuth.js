import { reactive, computed } from 'vue'
import { auth, db } from '../services/firebase'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { isStudentEmail } from '../utils/studentEmail.js'

// state.user est une copie simple ({ uid, email, emailVerified }), jamais
// l'instance Firebase elle-même : Vue ne détecterait pas une mutation de ses
// champs (reload(), voir refreshUser), seule une réaffectation de l'objet
// déclenche la réactivité. Toute lecture du profil doit donc repasser par ici.
const toPlainUser = (firebaseUser) =>
  firebaseUser ? { uid: firebaseUser.uid, email: firebaseUser.email, emailVerified: firebaseUser.emailVerified } : null

const state = reactive({
  user: null,
  isAdmin: false,
  // Le temps de la vérification (une lecture Firestore) après une connexion,
  // pour ne pas afficher par erreur "email non vérifié" à un admin dont le
  // statut n'est pas encore connu (voir LoginForm.vue).
  checkingAdmin: false
})

// Être authentifié ne suffit pas à être admin : il faut avoir un document
// admins/{uid}, créé à la main depuis la console Firebase (voir
// firestore.rules, qui fait foi ; ce contrôle ne sert qu'à afficher l'UI).
const handleAuthChange = async (firebaseUser) => {
  state.user = toPlainUser(firebaseUser)
  state.isAdmin = false
  if (!firebaseUser) {
    state.checkingAdmin = false
    return
  }
  state.checkingAdmin = true
  try {
    const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid))
    // L'utilisateur a pu changer pendant l'aller-retour réseau.
    if (state.user?.uid === firebaseUser.uid) state.isAdmin = adminDoc.exists()
  } catch (e) {
    console.error('Erreur lors de la vérification du compte administrateur :', e)
  } finally {
    if (state.user?.uid === firebaseUser.uid) state.checkingAdmin = false
  }
}
onAuthStateChanged(auth, handleAuthChange)

// Un étudiant vérifié est un compte dont l'email étudiant a été confirmé
// (lien de vérification cliqué : emailVerified reste faux tant que ce n'est
// pas fait) et qui n'est pas admin.
const studentEmail = computed(() => {
  const user = state.user
  if (!user || state.isAdmin || !user.emailVerified || !isStudentEmail(user.email)) return null
  return user.email
})

// Les contacts d'une entreprise (formulaire complet) ne sont montrés qu'aux
// étudiants vérifiés et aux admins (firestore.rules l'impose aussi : ce
// n'est pas qu'un affichage). Sert aussi à l'icône de connexion de la
// sidebar, à titre indicatif.
const canViewContacts = computed(() => state.isAdmin || !!studentEmail.value)

export function useAuth() {
  const login = (email, password) => signInWithEmailAndPassword(auth, email, password)
  const logout = () => signOut(auth)

  // Création d'un compte étudiant : email + mot de passe, réservé au domaine
  // étudiant (les admins sont créés à la main dans la console Firebase, pas
  // via ce formulaire). Envoie l'email de vérification standard de Firebase,
  // puis déconnecte immédiatement : tant que le lien n'a pas été cliqué,
  // l'étudiant doit repasser par le formulaire de connexion (qui explique
  // pourquoi), pas rester connecté avec un compte non vérifié.
  const signup = async (email, password) => {
    const address = email.trim()
    if (!isStudentEmail(address)) throw new Error('Not a student email address')
    const credential = await createUserWithEmailAndPassword(auth, address, password)
    try {
      await sendEmailVerification(credential.user, {
        url: `${window.location.origin}${window.location.pathname}`
      })
    } finally {
      await signOut(auth)
    }
  }

  // Renvoie l'email de vérification au compte actuellement connecté (cas
  // d'un étudiant qui ne l'a pas reçu, ou l'a perdu dans ses indésirables).
  const resendVerificationEmail = () => {
    if (!auth.currentUser) throw new Error('Not signed in')
    return sendEmailVerification(auth.currentUser, {
      url: `${window.location.origin}${window.location.pathname}`
    })
  }

  // Recharge le profil du compte connecté (après avoir cliqué le lien de
  // vérification dans un autre onglet, par exemple) : emailVerified n'est
  // sinon jamais mis à jour côté client tant qu'on ne redemande pas l'info.
  const refreshUser = async () => {
    if (!auth.currentUser) return
    await auth.currentUser.reload()
    state.user = toPlainUser(auth.currentUser)
  }

  return {
    user: computed(() => state.user),
    isAdmin: computed(() => state.isAdmin),
    checkingAdmin: computed(() => state.checkingAdmin),
    studentEmail,
    canViewContacts,
    login,
    logout,
    signup,
    resendVerificationEmail,
    refreshUser
  }
}
