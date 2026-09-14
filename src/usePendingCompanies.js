import { ref, watchEffect } from 'vue'
import { db } from './firebase'
import { collection, onSnapshot, addDoc, doc, deleteDoc } from 'firebase/firestore'
import { useAuth } from './useAuth.js'

const pendingCompanies = ref([])
const { isAdmin } = useAuth()
let unsubscribe = null

// Le listing des entreprises en attente n'a de sens que pour un admin
// (les règles Firestore refusent de toute façon la lecture aux autres) :
// on ne s'abonne donc qu'une fois connecté, et on se désabonne à la déconnexion.
watchEffect(() => {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
  if (isAdmin.value) {
    unsubscribe = onSnapshot(collection(db, 'pendingCompanies'), (snapshot) => {
      pendingCompanies.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    })
  } else {
    pendingCompanies.value = []
  }
})

export function usePendingCompanies() {
  // Soumission publique : l'entreprise part en attente de validation.
  const submitPending = (data) => addDoc(collection(db, 'pendingCompanies'), data)

  // Validation admin : bascule la proposition (potentiellement modifiée)
  // vers la collection publique, puis retire l'entrée en attente.
  const approve = async (pendingId, data) => {
    await addDoc(collection(db, 'companies'), data)
    await deleteDoc(doc(db, 'pendingCompanies', pendingId))
  }

  const reject = (pendingId) => deleteDoc(doc(db, 'pendingCompanies', pendingId))

  return { pendingCompanies, submitPending, approve, reject }
}
