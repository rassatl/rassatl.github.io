import { ref, watchEffect } from 'vue'
import { db } from '../services/firebase'
import { collection, onSnapshot, addDoc, doc, deleteDoc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore'
import { useAuth } from './useAuth.js'
import { useEmailNotifications } from './useEmailNotifications.js'

const pendingCompanies = ref([])
const { isAdmin, studentEmail } = useAuth()
const { notifyContacts } = useEmailNotifications()
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

const fetchContacts = async (parentCollection, parentId) => {
  const snapshot = await getDocs(collection(db, parentCollection, parentId, 'contacts'))
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

const deleteContacts = async (parentCollection, parentId, contacts) => {
  await Promise.all(contacts.map(({ id }) => deleteDoc(doc(db, parentCollection, parentId, 'contacts', id))))
}

// Publie les contacts saisis dans le formulaire sous une entreprise déjà
// créée, en générant pour chacun le jeton qui permettra de masquer ses
// informations personnelles depuis le lien envoyé par email.
const publishContacts = async (contacts, companyId) => {
  const published = []
  for (const contact of contacts) {
    const data = {
      firstName: contact.firstName,
      lastName: contact.lastName,
      role: contact.role,
      email: contact.email,
      phone: contact.phone,
      hidden: false,
      hideToken: crypto.randomUUID(),
    }
    const contactRef = await addDoc(collection(db, 'companies', companyId, 'contacts'), data)
    published.push({ id: contactRef.id, ...data })
  }
  return published
}

// Publie une entreprise validée. Quand elle vient d'une proposition
// d'étudiant, l'auteur est consigné dans la collection privée companyAuthors
// (réservée aux admins) dans la même écriture atomique : la trace survit ainsi
// à la suppression de la proposition. L'email n'est recopié sur l'entreprise
// publique (addedBy) que si l'étudiant a choisi de s'afficher.
const publishCompany = async (data, author) => {
  const companyRef = doc(collection(db, 'companies'))
  const batch = writeBatch(db)
  batch.set(companyRef, author?.email && author.visible ? { ...data, addedBy: author.email } : data)
  if (author?.email) {
    batch.set(doc(db, 'companyAuthors', companyRef.id), {
      submittedBy: author.email,
      visible: !!author.visible,
      companyName: data.name,
      approvedAt: serverTimestamp(),
    })
  }
  await batch.commit()
  return companyRef
}

export function usePendingCompanies() {
  // Soumission par un étudiant vérifié : l'entreprise et ses contacts partent
  // en attente de validation (pas encore de jeton de masquage, pas encore
  // d'email envoyé). L'email étudiant n'est conservé que sur la proposition,
  // visible des seuls admins, avec le choix de l'étudiant de s'afficher (ou
  // non) sur l'entreprise publiée (voir approve).
  const submitPending = async (data, contacts, { visible = false } = {}) => {
    if (!studentEmail.value) throw new Error('Student email not verified')
    const pendingRef = await addDoc(collection(db, 'pendingCompanies'), {
      ...data,
      submittedBy: studentEmail.value,
      submitterVisible: !!visible
    })
    await Promise.all(contacts.map(contact =>
      addDoc(collection(db, 'pendingCompanies', pendingRef.id, 'contacts'), contact)
    ))
    return pendingRef.id
  }

  // Validation admin : publie la proposition (potentiellement modifiée) et
  // ses contacts, prévient chaque contact par email, puis retire l'entrée en
  // attente (document et sous-collection de contacts). `author` est l'auteur
  // de la proposition : { email, visible }.
  const approve = async (pendingId, data, contacts, author) => {
    const companyRef = await publishCompany(data, author)
    const publishedContacts = await publishContacts(contacts, companyRef.id)

    const oldContacts = await fetchContacts('pendingCompanies', pendingId)
    await deleteContacts('pendingCompanies', pendingId, oldContacts)
    await deleteDoc(doc(db, 'pendingCompanies', pendingId))

    await notifyContacts(publishedContacts, data.name, companyRef.id)
    return companyRef.id
  }

  // Ajout direct par un admin : publié immédiatement, ce qui vaut validation
  // (mêmes effets que l'approbation d'une proposition en attente).
  const addCompanyDirectly = async (data, contacts) => {
    const companyRef = await addDoc(collection(db, 'companies'), data)
    const publishedContacts = await publishContacts(contacts, companyRef.id)
    await notifyContacts(publishedContacts, data.name, companyRef.id)
    return companyRef.id
  }

  const reject = async (pendingId) => {
    const oldContacts = await fetchContacts('pendingCompanies', pendingId)
    await deleteContacts('pendingCompanies', pendingId, oldContacts)
    await deleteDoc(doc(db, 'pendingCompanies', pendingId))
  }

  return { pendingCompanies, submitPending, approve, addCompanyDirectly, reject, fetchContacts }
}
