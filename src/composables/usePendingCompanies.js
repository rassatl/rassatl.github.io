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

// Moyen de contact du formulaire confidentiel (email perso, email étudiant,
// WhatsApp, LinkedIn) : un seul document, pas de sous-collection à parcourir.
const fetchConfidentialContact = async (parentCollection, parentId) => {
  const snapshot = await getDocs(collection(db, parentCollection, parentId, 'confidentialContact'))
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

const deleteConfidentialContact = async (parentCollection, parentId, docs) => {
  await Promise.all(docs.map(({ id }) => deleteDoc(doc(db, parentCollection, parentId, 'confidentialContact', id))))
}

// Le moyen de contact est entièrement facultatif : {} (rien de rempli) ne
// doit pas créer de document vide.
const hasConfidentialContact = (confidentialContact) =>
  !!confidentialContact && Object.keys(confidentialContact).length > 0

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

// Publie une entreprise validée, format complet ou confidentiel. Pour le
// format complet, quand elle vient d'une proposition attribuée, l'auteur est
// consigné dans la collection privée companyAuthors (réservée aux admins)
// dans la même écriture atomique : la trace survit ainsi à la suppression de
// la proposition. L'email n'est recopié sur l'entreprise publique (addedBy)
// que si l'étudiant a choisi de s'afficher. Une proposition confidentielle
// n'a jamais d'auteur (`author` vaut alors null).
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
  // Soumission d'une proposition. Deux formats :
  // - complet (`contacts` fourni, même vide un tableau) : réservé à un
  //   étudiant vérifié connecté, automatiquement attribué (son email et son
  //   choix de visibilité) ;
  // - confidentiel (`contacts` omis) : toujours anonyme, envoyé par un
  //   visiteur non connecté, jamais d'auteur ni de contacts « de
  //   l'entreprise » ; `confidentialContact` porte à la place le moyen de
  //   joindre l'étudiant lui-même (email perso, email étudiant, WhatsApp,
  //   LinkedIn), entièrement facultatif : rien n'est écrit s'il est vide.
  const submitPending = async (data, { visible = false, contacts = null, confidentialContact = null } = {}) => {
    if (contacts !== null) {
      if (!studentEmail.value) throw new Error('Student email not verified')
      const pendingRef = await addDoc(collection(db, 'pendingCompanies'), {
        ...data,
        submittedBy: studentEmail.value,
        submitterVisible: !!visible,
      })
      await Promise.all(contacts.map(contact =>
        addDoc(collection(db, 'pendingCompanies', pendingRef.id, 'contacts'), contact)
      ))
      return pendingRef.id
    }
    const pendingRef = await addDoc(collection(db, 'pendingCompanies'), data)
    if (hasConfidentialContact(confidentialContact)) {
      await addDoc(collection(db, 'pendingCompanies', pendingRef.id, 'confidentialContact'), confidentialContact)
    }
    return pendingRef.id
  }

  // Validation admin : publie la proposition (potentiellement modifiée), ses
  // contacts s'il y en a (prévenus par email), ou son moyen de contact
  // confidentiel s'il y en a un (potentiellement corrigé pendant la révision,
  // d'où `confidentialContact` fourni explicitement plutôt que relu depuis la
  // proposition en attente), puis retire l'entrée en attente (document et
  // sous-collections). `contacts` vaut null pour une proposition
  // confidentielle (jamais de contacts « de l'entreprise »). `author` est
  // l'auteur de la proposition, s'il y en a un : { email, visible }.
  const approve = async (pendingId, data, contacts, author, confidentialContact = null) => {
    const companyRef = await publishCompany(data, author)

    if (contacts) {
      const publishedContacts = await publishContacts(contacts, companyRef.id)
      const oldContacts = await fetchContacts('pendingCompanies', pendingId)
      await deleteContacts('pendingCompanies', pendingId, oldContacts)
      await notifyContacts(publishedContacts, data.name, companyRef.id)
    }

    if (hasConfidentialContact(confidentialContact)) {
      await addDoc(collection(db, 'companies', companyRef.id, 'confidentialContact'), confidentialContact)
    }
    const oldConfidentialContact = await fetchConfidentialContact('pendingCompanies', pendingId)
    await deleteConfidentialContact('pendingCompanies', pendingId, oldConfidentialContact)

    await deleteDoc(doc(db, 'pendingCompanies', pendingId))
    return companyRef.id
  }

  // Ajout direct par un admin : publié immédiatement, ce qui vaut validation
  // (mêmes effets que l'approbation d'une proposition en attente). Un admin
  // passe toujours par le formulaire complet (voir AddCompanyForm.vue).
  const addCompanyDirectly = async (data, contacts) => {
    const companyRef = await addDoc(collection(db, 'companies'), data)
    const publishedContacts = await publishContacts(contacts, companyRef.id)
    await notifyContacts(publishedContacts, data.name, companyRef.id)
    return companyRef.id
  }

  const reject = async (pendingId) => {
    const oldContacts = await fetchContacts('pendingCompanies', pendingId)
    await deleteContacts('pendingCompanies', pendingId, oldContacts)
    const oldConfidentialContact = await fetchConfidentialContact('pendingCompanies', pendingId)
    await deleteConfidentialContact('pendingCompanies', pendingId, oldConfidentialContact)
    await deleteDoc(doc(db, 'pendingCompanies', pendingId))
  }

  return { pendingCompanies, submitPending, approve, addCompanyDirectly, reject, fetchContacts, fetchConfidentialContact }
}
