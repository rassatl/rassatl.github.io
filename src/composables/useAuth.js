import { reactive, computed } from 'vue'
import { auth, db } from '../services/firebase'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { isStudentEmail } from '../utils/studentEmail.js'
import { useEmailNotifications } from './useEmailNotifications.js'

// state.user est une copie simple ({ uid, email }), jamais l'instance
// Firebase elle-même : Vue ne détecterait pas une mutation de ses champs,
// seule une réaffectation de l'objet déclenche la réactivité.
const toPlainUser = (firebaseUser) =>
  firebaseUser ? { uid: firebaseUser.uid, email: firebaseUser.email } : null

// Jeton de vérification email : aléatoire, jamais deviné (voir
// emailVerificationTokens dans firestore.rules, qui impose au moins 24
// caractères). 32 octets en hexadécimal (64 caractères) donne une marge
// large au-dessus de ce minimum.
const generateVerificationToken = () => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const state = reactive({
  user: null,
  isAdmin: false,
  // Un étudiant vérifié est un compte dont l'email a été confirmé via le
  // lien envoyé par EmailJS (voir studentAccounts dans firestore.rules), pas
  // le sendEmailVerification natif de Firebase (pas de Cloud Function pour
  // l'appliquer sans le forfait Blaze).
  studentVerified: false,
  // Le temps de la vérification (lectures Firestore) après une connexion,
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
  state.studentVerified = false
  if (!firebaseUser) {
    state.checkingAdmin = false
    return
  }
  state.checkingAdmin = true
  try {
    const [adminDoc, studentDoc] = await Promise.all([
      getDoc(doc(db, 'admins', firebaseUser.uid)),
      getDoc(doc(db, 'studentAccounts', firebaseUser.uid))
    ])
    // L'utilisateur a pu changer pendant l'aller-retour réseau.
    if (state.user?.uid === firebaseUser.uid) {
      state.isAdmin = adminDoc.exists()
      state.studentVerified = studentDoc.exists() && studentDoc.data().emailVerified === true
    }
  } catch (e) {
    console.error('Erreur lors de la vérification du compte administrateur :', e)
  } finally {
    if (state.user?.uid === firebaseUser.uid) state.checkingAdmin = false
  }
}
onAuthStateChanged(auth, handleAuthChange)

const studentEmail = computed(() => {
  const user = state.user
  if (!user || state.isAdmin || !state.studentVerified || !isStudentEmail(user.email)) return null
  return user.email
})

// Les contacts d'une entreprise (formulaire complet) ne sont montrés qu'aux
// étudiants vérifiés et aux admins (firestore.rules l'impose aussi : ce
// n'est pas qu'un affichage). Sert aussi à l'icône de connexion de la
// sidebar, à titre indicatif.
const canViewContacts = computed(() => state.isAdmin || !!studentEmail.value)

export function useAuth() {
  const { sendVerificationEmail } = useEmailNotifications()

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password)
  const logout = () => signOut(auth)

  // Création d'un compte étudiant : email + mot de passe, réservé au domaine
  // étudiant (les admins sont créés à la main dans la console Firebase, pas
  // via ce formulaire). Un jeton de vérification est créé dans Firestore et
  // envoyé par email (via EmailJS, voir VerifyAccountInfo.vue pour le lien),
  // puis le compte est immédiatement déconnecté : tant que le lien n'a pas
  // été cliqué, l'étudiant doit repasser par le formulaire de connexion (qui
  // explique pourquoi), pas rester connecté avec un compte non vérifié.
  const signup = async (email, password) => {
    const address = email.trim()
    if (!isStudentEmail(address)) throw new Error('Not a student email address')
    const credential = await createUserWithEmailAndPassword(auth, address, password)
    const uid = credential.user.uid
    const token = generateVerificationToken()
    try {
      await setDoc(doc(db, 'studentAccounts', uid), { email: address, emailVerified: false })
      await setDoc(doc(db, 'emailVerificationTokens', uid), {
        email: address, token, verified: false, createdAt: new Date()
      })
      await sendVerificationEmail(address, uid, token)
    } finally {
      await signOut(auth)
    }
  }

  // Renvoie l'email de vérification au compte actuellement connecté (cas
  // d'un étudiant qui ne l'a pas reçu, ou l'a perdu dans ses indésirables) :
  // un nouveau jeton est généré, ce qui invalide l'ancien lien.
  const resendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error('Not signed in')
    const { uid, email } = auth.currentUser
    const token = generateVerificationToken()
    await updateDoc(doc(db, 'emailVerificationTokens', uid), {
      email, token, verified: false, createdAt: new Date()
    })
    await sendVerificationEmail(email, uid, token)
  }

  // Relit le statut de vérification depuis Firestore (après avoir cliqué le
  // lien de vérification dans un autre onglet, par exemple) : rien ne le met
  // sinon à jour côté client tant qu'on ne redemande pas l'info.
  const refreshUser = async () => {
    if (!auth.currentUser) return
    await handleAuthChange(auth.currentUser)
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
