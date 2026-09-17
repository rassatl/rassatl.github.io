import { ref, computed, watchEffect } from 'vue'
import { db } from '../services/firebase'
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore'
import { useAuth } from './useAuth.js'

const tickets = ref([])
const { isAdmin } = useAuth()
let unsubscribe = null

// Comme pour les propositions en attente : seul un admin peut lister les
// tickets (les règles Firestore l'imposent de toute façon), on ne s'abonne
// donc qu'une fois connecté, et on se désabonne à la déconnexion.
watchEffect(() => {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
  if (isAdmin.value) {
    const ticketsQuery = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'))
    unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
      tickets.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    })
  } else {
    tickets.value = []
  }
})

export function useTickets() {
  // Nombre de tickets qui ne sont pas encore fermés, pour le badge affiché
  // dans la sidebar (voir ListeDeroulante.vue).
  const openCount = computed(() => tickets.value.filter(ticket => ticket.status !== 'closed').length)

  // Signalement public : n'importe qui (y compris un visiteur non connecté)
  // peut signaler un problème depuis le bouton d'info. pageUrl/userAgent
  // sont capturés automatiquement pour faciliter le diagnostic.
  const submitTicket = async ({ title, description }) => {
    await addDoc(collection(db, 'tickets'), {
      title: title ?? '',
      description,
      status: 'open',
      createdAt: serverTimestamp(),
      pageUrl: window.location.href.slice(0, 500),
      userAgent: navigator.userAgent.slice(0, 300),
    })
  }

  // Seul le statut peut être modifié après création (voir firestore.rules) :
  // updateDoc ne touche que ce champ, le reste du document est inchangé.
  const updateTicketStatus = async (ticketId, status) => {
    await updateDoc(doc(db, 'tickets', ticketId), { status })
  }

  const deleteTicket = async (ticketId) => {
    await deleteDoc(doc(db, 'tickets', ticketId))
  }

  return { tickets, openCount, submitTicket, updateTicketStatus, deleteTicket }
}
