import { reactive, computed } from 'vue'
import { auth } from './firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'

const state = reactive({
  user: null
})

onAuthStateChanged(auth, (firebaseUser) => {
  state.user = firebaseUser
})

// Toute personne authentifiée est considérée admin : il n'y a pas d'inscription
// publique, seul un administrateur peut créer un compte via la console Firebase.
export function useAuth() {
  const login = (email, password) => signInWithEmailAndPassword(auth, email, password)
  const logout = () => signOut(auth)

  return {
    user: computed(() => state.user),
    isAdmin: computed(() => !!state.user),
    login,
    logout
  }
}
