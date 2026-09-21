import { test, expect } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './fixtures/emulator.js'
import { idTokenFor, createDocument, listDocuments, getDocument } from './fixtures/firestore-rest.js'

// Ces tests attaquent Firestore directement, sans passer par le formulaire :
// c'est ce que ferait quelqu'un qui contourne l'interface. Ils prouvent que
// la vérification de l'email étudiant est imposée par firestore.rules, et
// pas seulement par l'interface.

const RUN_ID = crypto.randomUUID().slice(0, 8)
const STUDENT_EMAIL = `regles.${RUN_ID}@groupe-esigelec.org`

const company = (overrides = {}) => ({
  speciality: 'IA & Big Data',
  name: `E2E Rules Co ${RUN_ID}`,
  address: '1 rue des Règles',
  city: 'Rouen',
  country: 'France',
  pc: '76000',
  x: 49.4431,
  y: 1.0993,
  mission: 'Mission de test.',
  ...overrides,
})

// Proposition telle que l'envoie le formulaire : l'auteur et son choix de
// s'afficher (ou non) sur l'entreprise publiée.
const proposal = (submittedBy, overrides = {}) =>
  company({ submittedBy, submitterVisible: false, ...overrides })

const contact = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  role: 'CTO',
  email: 'ada@example.com',
  phone: '',
}

test.describe('proposition d\'entreprise : réservée aux étudiants vérifiés', () => {
  test('un visiteur anonyme ne peut pas proposer d\'entreprise', async () => {
    const { status } = await createDocument(null, 'pendingCompanies', proposal(STUDENT_EMAIL))
    expect(status).toBe(403)
  })

  test('un compte au domaine étudiant mais dont l\'email n\'est pas vérifié est refusé', async () => {
    const email = `non.verifie.${RUN_ID}@groupe-esigelec.org`
    const { idToken } = await idTokenFor(email, { emailVerified: false })
    const { status } = await createDocument(idToken, 'pendingCompanies', proposal(email))
    expect(status).toBe(403)
  })

  test('un email vérifié mais hors du domaine étudiant est refusé', async () => {
    const email = `externe.${RUN_ID}@gmail.com`
    const { idToken } = await idTokenFor(email, { emailVerified: true })
    const { status } = await createDocument(idToken, 'pendingCompanies', proposal(email))
    expect(status).toBe(403)
  })

  test('un étudiant vérifié peut proposer une entreprise, avec son propre email', async () => {
    const { idToken } = await idTokenFor(STUDENT_EMAIL, { emailVerified: true })
    const { status } = await createDocument(idToken, 'pendingCompanies', proposal(STUDENT_EMAIL))
    expect(status).toBe(200)
  })

  test('la proposition doit porter l\'email de son auteur, pas celui d\'un autre', async () => {
    const { idToken } = await idTokenFor(STUDENT_EMAIL, { emailVerified: true })

    const impersonated = await createDocument(
      idToken, 'pendingCompanies', proposal('quelquun.d.autre@groupe-esigelec.org')
    )
    expect(impersonated.status).toBe(403)

    const withoutAuthor = await createDocument(idToken, 'pendingCompanies', company({ submitterVisible: false }))
    expect(withoutAuthor.status).toBe(403)
  })

  test('le choix de visibilité est obligatoire et doit être un booléen', async () => {
    const { idToken } = await idTokenFor(STUDENT_EMAIL, { emailVerified: true })

    const { submitterVisible, ...withoutChoice } = proposal(STUDENT_EMAIL)
    expect(submitterVisible).toBe(false)
    expect((await createDocument(idToken, 'pendingCompanies', withoutChoice)).status).toBe(403)

    const notABoolean = proposal(STUDENT_EMAIL, { submitterVisible: 'oui' })
    expect((await createDocument(idToken, 'pendingCompanies', notABoolean)).status).toBe(403)

    expect((await createDocument(idToken, 'pendingCompanies', proposal(STUDENT_EMAIL, { submitterVisible: true }))).status).toBe(200)
  })

  test("un étudiant ne peut pas s'attribuer un email public (addedBy) sur sa proposition", async () => {
    const { idToken } = await idTokenFor(STUDENT_EMAIL, { emailVerified: true })
    const forged = proposal(STUDENT_EMAIL, { addedBy: STUDENT_EMAIL })
    expect((await createDocument(idToken, 'pendingCompanies', forged)).status).toBe(403)
  })

  test('les contacts ne peuvent être ajoutés que par l\'auteur de la proposition', async () => {
    const author = await idTokenFor(STUDENT_EMAIL, { emailVerified: true })
    const { id } = await createDocument(author.idToken, 'pendingCompanies', proposal(STUDENT_EMAIL))

    const own = await createDocument(author.idToken, `pendingCompanies/${id}/contacts`, contact)
    expect(own.status).toBe(200)

    const other = await idTokenFor(`autre.${RUN_ID}@groupe-esigelec.org`, { emailVerified: true })
    const foreign = await createDocument(other.idToken, `pendingCompanies/${id}/contacts`, contact)
    expect(foreign.status).toBe(403)

    const anonymous = await createDocument(null, `pendingCompanies/${id}/contacts`, contact)
    expect(anonymous.status).toBe(403)
  })
})

test.describe('un étudiant vérifié n\'a aucun droit d\'administrateur', () => {
  test('il ne peut ni lire les propositions, ni publier une entreprise, ni lire les tickets', async () => {
    const { idToken } = await idTokenFor(STUDENT_EMAIL, { emailVerified: true })

    expect(await listDocuments(idToken, 'pendingCompanies')).toBe(403)
    expect(await listDocuments(idToken, 'tickets')).toBe(403)
    expect(await listDocuments(idToken, 'errorLogs')).toBe(403)
    expect((await createDocument(idToken, 'companies', company())).status).toBe(403)
  })

  test('il ne peut pas se donner les droits admin en écrivant son propre document admins', async () => {
    const { idToken } = await idTokenFor(STUDENT_EMAIL, { emailVerified: true })

    expect((await createDocument(idToken, 'admins', { role: 'admin' })).status).toBe(403)
    expect(await listDocuments(idToken, 'admins')).toBe(403)
  })

  test("il ne peut ni lire ni écrire la collection privée des auteurs", async () => {
    const { idToken } = await idTokenFor(STUDENT_EMAIL, { emailVerified: true })
    const record = {
      submittedBy: STUDENT_EMAIL,
      visible: false,
      companyName: `E2E Rules Co ${RUN_ID}`,
    }

    expect(await listDocuments(idToken, 'companyAuthors')).toBe(403)
    expect(await listDocuments(null, 'companyAuthors')).toBe(403)
    expect((await createDocument(idToken, 'companyAuthors', record)).status).toBe(403)
    expect((await createDocument(null, 'companyAuthors', record)).status).toBe(403)
  })

  test('un admin (compte listé dans admins) conserve ses droits', async () => {
    const { idToken } = await idTokenFor(ADMIN_EMAIL, { password: ADMIN_PASSWORD })

    expect(await listDocuments(idToken, 'pendingCompanies')).toBe(200)
    expect(await listDocuments(idToken, 'tickets')).toBe(200)
    expect((await createDocument(idToken, 'companies', company({ name: `E2E Admin Co ${RUN_ID}` }))).status).toBe(200)
    // Le seul moyen d'afficher l'auteur publiquement passe par un admin.
    const visibleAuthor = company({ name: `E2E Admin Visible Co ${RUN_ID}`, addedBy: STUDENT_EMAIL })
    expect((await createDocument(idToken, 'companies', visibleAuthor)).status).toBe(200)
    expect(await listDocuments(idToken, 'companyAuthors')).toBe(200)
  })
})

test.describe("contacts d'une entreprise : réservés aux étudiants vérifiés", () => {
  let contactsPath
  let contactPath

  test.beforeAll(async () => {
    // Seul un admin peut publier une entreprise et ses contacts.
    const { idToken } = await idTokenFor(ADMIN_EMAIL, { password: ADMIN_PASSWORD })
    const { id: companyId } = await createDocument(idToken, 'companies', company({ name: `E2E Contacts Co ${RUN_ID}` }))
    contactsPath = `companies/${companyId}/contacts`
    const { id: contactId } = await createDocument(idToken, contactsPath, {
      ...contact,
      hidden: false,
      hideToken: 'e2e-hide-token-0123456789',
    })
    contactPath = `${contactsPath}/${contactId}`
  })

  test('un visiteur anonyme ne peut pas lister les contacts', async () => {
    expect(await listDocuments(null, contactsPath)).toBe(403)
  })

  test('un compte au domaine étudiant mais non vérifié, ou vérifié hors domaine, ne les voit pas', async () => {
    const unverified = await idTokenFor(`contacts.non.verifie.${RUN_ID}@groupe-esigelec.org`, { emailVerified: false })
    expect(await listDocuments(unverified.idToken, contactsPath)).toBe(403)

    const outsider = await idTokenFor(`contacts.externe.${RUN_ID}@gmail.com`, { emailVerified: true })
    expect(await listDocuments(outsider.idToken, contactsPath)).toBe(403)
  })

  test('un étudiant vérifié et un admin peuvent les lister', async () => {
    const student = await idTokenFor(STUDENT_EMAIL, { emailVerified: true })
    expect(await listDocuments(student.idToken, contactsPath)).toBe(200)

    const admin = await idTokenFor(ADMIN_EMAIL, { password: ADMIN_PASSWORD })
    expect(await listDocuments(admin.idToken, contactsPath)).toBe(200)
  })

  test("la lecture d'un contact précis reste ouverte, pour le lien « masquer mes informations »", async () => {
    // Le lien envoyé au contact contient son identifiant : il doit pouvoir
    // s'en servir sans être connecté, alors que la liste, elle, est fermée.
    expect(await getDocument(null, contactPath)).toBe(200)
  })
})
