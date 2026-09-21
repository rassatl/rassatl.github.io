import { adminDb } from './emulator.js'

// Écrit directement via firebase-admin (donc en contournant firestore.rules,
// comme le ferait la console Firebase) une entreprise publiée avec ses
// contacts, pour les tests qui vérifient l'affichage public (liste, filtre,
// détails) sans passer par le formulaire d'ajout.
export async function seedCompany(data, contacts = []) {
  const db = adminDb()
  const companyRef = await db.collection('companies').add(data)
  await Promise.all(
    contacts.map((contact) => db.collection('companies').doc(companyRef.id).collection('contacts').add(contact))
  )
  return companyRef.id
}

// Écrit une proposition en attente de validation, comme le ferait un
// visiteur via AddCompanyForm, pour les tests du parcours de modération
// admin (e2e/admin.spec.js) sans repasser par tout le formulaire public.
export async function seedPendingCompany(data, contacts = []) {
  const db = adminDb()
  const pendingRef = await db.collection('pendingCompanies').add(data)
  await Promise.all(
    contacts.map((contact) => db.collection('pendingCompanies').doc(pendingRef.id).collection('contacts').add(contact))
  )
  return pendingRef.id
}

// Écrit la trace privée de l'auteur d'une entreprise publiée (collection
// companyAuthors, lisible des seuls admins), comme le fait la validation d'une
// proposition.
export async function seedCompanyAuthor(companyId, data) {
  await adminDb().collection('companyAuthors').doc(companyId).set(data)
}
