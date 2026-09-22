import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './fixtures/login.js'
import { mockNominatim } from './fixtures/nominatim.js'
import { seedPendingCompany, seedCompany, seedCompanyAuthor, seedConfidentialContact } from './fixtures/seed.js'
import { adminDb, ADMIN_EMAIL } from './fixtures/emulator.js'

const RUN_ID = crypto.randomUUID().slice(0, 8)

test('un admin peut se connecter puis se déconnecter', async ({ page }) => {
  await page.goto('/')
  await loginAsAdmin(page)

  // loginAsAdmin attend déjà que le bouton reflète l'état connecté ; on le
  // rouvre pour vérifier le contenu de la modale (email affiché).
  await page.getByRole('button', { name: 'Connecté en tant qu\'administrateur' }).click()
  await expect(page.getByRole('heading', { name: 'Connecté en tant qu\'administrateur' })).toBeVisible()
  await expect(page.getByText(ADMIN_EMAIL)).toBeVisible()

  // Se déconnecter ferme aussi la modale, ce qui referme la sidebar (même
  // comportement que l'ouverture, voir loginAsAdmin) : on la rouvre pour
  // vérifier que le bouton de connexion est bien revenu à son état initial.
  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await page.locator('.toggle-button').click()
  await expect(page.getByRole('button', { name: 'Connexion' })).toBeVisible()
})

test.describe('modération des propositions en attente (format complet)', () => {
  test('un admin peut refuser une proposition', async ({ page }) => {
    const name = `E2E Reject Co ${RUN_ID}`
    await seedPendingCompany({
      speciality: 'Développement Logiciel, Tests et Qualité',
      name,
      address: '5 rue du Refus',
      city: 'Nantes',
      country: 'France',
      pc: '44000',
      x: 47.2184,
      y: -1.5536,
      mission: 'Mission à refuser.',
    })

    await page.goto('/')
    await loginAsAdmin(page)

    await page.getByRole('button', { name: 'Liste des entreprises en attente' }).click()
    const item = page.locator('.pending-companies li', { hasText: name })
    await expect(item).toBeVisible()

    page.once('dialog', (dialog) => dialog.accept())
    await item.getByRole('button', { name: 'Refuser' }).click()

    await expect(item).toHaveCount(0)

    // La liste (onSnapshot) reflète l'écriture locale avant même que
    // deleteDoc() ne soit confirmé côté serveur : on attend donc que
    // l'émulateur soit à jour plutôt que de l'interroger une seule fois.
    await expect.poll(async () => {
      const snapshot = await adminDb().collection('pendingCompanies').where('name', '==', name).get()
      return snapshot.size
    }).toBe(0)
  })

  test('un admin peut valider une proposition, qui devient publique', async ({ page }) => {
    const name = `E2E Approve Co ${RUN_ID}`
    await seedPendingCompany({
      speciality: 'IA & Big Data',
      name,
      address: '7 rue de la Validation',
      city: 'Bordeaux',
      country: 'France',
      pc: '33000',
      x: 44.8378,
      y: -0.5792,
      mission: 'Mission à valider.',
      submittedBy: 'etudiant.propose@groupe-esigelec.org',
      submitterVisible: false,
    }, [
      { firstName: 'Julien', lastName: 'Petit', role: 'Manager', email: 'julien.petit@example.com', phone: '' },
    ])

    await mockNominatim(page, { country: 'France' })
    await page.goto('/')
    await loginAsAdmin(page)

    await page.getByRole('button', { name: 'Liste des entreprises en attente' }).click()
    const item = page.locator('.pending-companies li', { hasText: name })
    // L'admin voit qui a proposé l'entreprise.
    await expect(item).toContainText('etudiant.propose@groupe-esigelec.org')
    await item.getByRole('button', { name: 'Modifier / Valider' }).click()
    await expect(page.locator('.submitted-by')).toContainText('etudiant.propose@groupe-esigelec.org')
    await expect(page.locator('.submitted-by')).toContainText('Son email restera privé')

    // Le formulaire de révision précharge les contacts de la proposition via
    // un appel Firestore asynchrone (voir ContactsStep.vue) : on attend que
    // le champ soit rempli avant de valider, sinon la validation du contact
    // échoue sur des champs encore vides.
    await expect(page.locator('#contact-firstName-0')).toHaveValue('Julien')

    await page.getByRole('button', { name: 'Valider' }).click()

    await expect(page.locator('.pending-companies li', { hasText: name })).toHaveCount(0)

    // Même remarque que pour le refus : approve() enchaîne plusieurs
    // écritures Firestore (publication, contacts, suppression de la
    // proposition) après que la liste s'est déjà mise à jour localement.
    await expect.poll(async () => {
      const snapshot = await adminDb().collection('pendingCompanies').where('name', '==', name).get()
      return snapshot.size
    }).toBe(0)

    const companySnapshot = await adminDb().collection('companies').where('name', '==', name).get()
    expect(companySnapshot.size).toBe(1)
    // L'entreprise publiée est lisible par tout le monde : l'email de
    // l'étudiant qui l'a proposée n'y figure pas quand il a choisi de rester
    // privé...
    expect(companySnapshot.docs[0].data()).not.toHaveProperty('submittedBy')
    expect(companySnapshot.docs[0].data()).not.toHaveProperty('addedBy')
    // ... mais l'auteur est conservé à part, dans la collection privée, même
    // si la proposition en attente a été supprimée.
    const author = await adminDb().collection('companyAuthors').doc(companySnapshot.docs[0].id).get()
    expect(author.data()).toMatchObject({
      submittedBy: 'etudiant.propose@groupe-esigelec.org',
      visible: false,
      companyName: name,
    })

    const contactsSnapshot = await companySnapshot.docs[0].ref.collection('contacts').get()
    expect(contactsSnapshot.size).toBe(1)
    expect(contactsSnapshot.docs[0].data().email).toBe('julien.petit@example.com')
  })

  test("si l'étudiant a choisi d'être visible, son email apparaît sur l'entreprise publiée", async ({ page }) => {
    const name = `E2E Visible Author Co ${RUN_ID}`
    await seedPendingCompany({
      speciality: 'IA & Big Data',
      name,
      address: '9 rue de la Visibilité',
      city: 'Lille',
      country: 'France',
      pc: '59000',
      x: 50.6292,
      y: 3.0573,
      mission: 'Mission à valider, auteur visible.',
      submittedBy: 'etudiant.visible@groupe-esigelec.org',
      submitterVisible: true,
    })

    await mockNominatim(page, { country: 'France' })
    await page.goto('/')
    await loginAsAdmin(page)

    await page.getByRole('button', { name: 'Liste des entreprises en attente' }).click()
    await page.locator('.pending-companies li', { hasText: name })
      .getByRole('button', { name: 'Modifier / Valider' }).click()
    await expect(page.locator('.submitted-by')).toContainText("Il a choisi d'afficher son email")

    await page.getByRole('button', { name: 'Valider' }).click()
    await expect(page.locator('.pending-companies li', { hasText: name })).toHaveCount(0)

    await expect.poll(async () => {
      const snapshot = await adminDb().collection('companies').where('name', '==', name).get()
      return snapshot.size
    }).toBe(1)

    const companySnapshot = await adminDb().collection('companies').where('name', '==', name).get()
    expect(companySnapshot.docs[0].data().addedBy).toBe('etudiant.visible@groupe-esigelec.org')
    expect(companySnapshot.docs[0].data()).not.toHaveProperty('submittedBy')

    const author = await adminDb().collection('companyAuthors').doc(companySnapshot.docs[0].id).get()
    expect(author.data()).toMatchObject({ submittedBy: 'etudiant.visible@groupe-esigelec.org', visible: true })
  })
})

test.describe('modération des propositions en attente (format confidentiel)', () => {
  test('un admin peut valider une proposition confidentielle, sans nom ni auteur, en republiant le moyen de contact', async ({ page }) => {
    const city = `E2E Confidential Approve City ${RUN_ID}`
    const pendingId = await seedPendingCompany({
      speciality: 'IA & Big Data',
      city,
      country: 'France',
      x: 43.6047,
      y: 1.4442,
    })
    await seedConfidentialContact('pendingCompanies', pendingId, { schoolEmail: 'etudiant.confidentiel@groupe-esigelec.org' })

    await mockNominatim(page, { country: 'France' })
    await page.goto('/')
    await loginAsAdmin(page)

    await page.getByRole('button', { name: 'Liste des entreprises en attente' }).click()
    const item = page.locator('.pending-companies li', { hasText: city })
    await expect(item.locator('.submitted-by')).toHaveCount(0)
    await item.getByRole('button', { name: 'Modifier / Valider' }).click()

    // Le formulaire de révision précharge le moyen de contact déjà déposé.
    await expect(page.locator('#contact-school-email')).toHaveValue('etudiant.confidentiel@groupe-esigelec.org')

    await page.getByRole('button', { name: 'Valider' }).click()
    await expect(page.locator('.pending-companies li', { hasText: city })).toHaveCount(0)

    await expect.poll(async () => {
      const snapshot = await adminDb().collection('companies').where('city', '==', city).get()
      return snapshot.size
    }).toBe(1)

    const companySnapshot = await adminDb().collection('companies').where('city', '==', city).get()
    const companyData = companySnapshot.docs[0].data()
    expect(companyData).not.toHaveProperty('name')
    expect(companyData).not.toHaveProperty('addedBy')
    const author = await adminDb().collection('companyAuthors').doc(companySnapshot.docs[0].id).get()
    expect(author.exists).toBe(false)

    const publishedContact = await companySnapshot.docs[0].ref.collection('confidentialContact').get()
    expect(publishedContact.size).toBe(1)
    expect(publishedContact.docs[0].data()).toEqual({ schoolEmail: 'etudiant.confidentiel@groupe-esigelec.org' })
  })
})

test("un admin voit l'auteur privé d'une entreprise, un visiteur non", async ({ page, browser }) => {
  const name = `E2E Private Author Co ${RUN_ID}`
  const authorEmail = 'etudiant.prive@groupe-esigelec.org'
  const companyId = await seedCompany({
    speciality: 'IA & Big Data',
    name,
    address: '3 rue du Secret',
    city: 'Tours',
    country: 'France',
    pc: '37000',
    x: 47.3941,
    y: 0.6848,
    mission: "Mission dont l'auteur reste privé.",
  })
  await seedCompanyAuthor(companyId, {
    submittedBy: authorEmail,
    visible: false,
    companyName: name,
    approvedAt: new Date(),
  })

  // Visiteur anonyme : la fiche n'affiche aucun auteur.
  const visitor = await browser.newPage()
  await visitor.goto('/')
  await visitor.locator('.company-item', { hasText: name }).click()
  await expect(visitor.locator('.modal-content').getByRole('heading', { name })).toBeVisible()
  await expect(visitor.locator('.modal-content')).not.toContainText(authorEmail)
  await visitor.close()

  // Admin : la fiche affiche l'auteur, en précisant qu'il est privé.
  await page.goto('/')
  await loginAsAdmin(page)
  await page.locator('.company-item', { hasText: name }).click()
  await expect(page.locator('.modal-content')).toContainText(authorEmail)
  await expect(page.locator('.modal-content')).toContainText('privé')
})

test("un admin voit les contacts sans avoir à vérifier d'email étudiant", async ({ page }) => {
  const name = `E2E Admin Contacts Co ${RUN_ID}`
  await seedCompany({
    speciality: 'IA & Big Data',
    name,
    address: '4 rue des Contacts',
    city: 'Angers',
    country: 'France',
    pc: '49000',
    x: 47.4784,
    y: -0.5632,
    mission: 'Mission avec un contact.',
  }, [
    {
      firstName: 'Nadia',
      lastName: 'Roux',
      role: 'Responsable stages',
      email: 'nadia.roux@example.com',
      phone: '',
      hidden: false,
      hideToken: 'e2e-hide-token-nadia-0123456789',
    },
  ])

  await page.goto('/')
  await loginAsAdmin(page)
  await page.locator('.company-item', { hasText: name }).click()

  const modal = page.locator('.modal-content')
  await expect(modal.getByText('Nadia Roux', { exact: false })).toBeVisible()
  await expect(modal.getByText('Les contacts sont réservés aux étudiants')).toHaveCount(0)
})

test("un admin ajoute directement une entreprise via le formulaire complet, sans passer par la modération", async ({ page }) => {
  const name = `E2E Direct Admin Co ${RUN_ID}`
  await mockNominatim(page, { country: 'France' })
  await page.goto('/')
  await loginAsAdmin(page)

  await page.getByRole('button', { name: 'Ajouter' }).click()
  // Un admin voit directement le formulaire complet, jamais l'étape
  // d'attribution ni le formulaire confidentiel.
  await expect(page.getByRole('heading', { name: 'Ajouter une entreprise', exact: true })).toBeVisible()

  await page.locator('#speciality').selectOption({ label: 'IA & Big Data' })
  await page.locator('#name').fill(name)
  await page.locator('#country').selectOption({ label: 'France' })
  await page.getByRole('tab', { name: 'Champs détaillés' }).click()
  await page.locator('#address').fill('11 rue de l\'Administration')
  await page.locator('#city').fill('Reims')
  await page.locator('#pc').fill('51100')
  await page.locator('.mini-map-wrapper .mini-map').click()
  await page.getByRole('button', { name: 'Suivant' }).click()

  await page.getByRole('button', { name: 'Suivant' }).click() // contacts, laissés vides
  await page.locator('#mission').fill('Mission ajoutée directement par un admin.')
  await page.getByRole('button', { name: 'Suivant' }).click()
  await page.getByRole('button', { name: "Ajouter l'entreprise" }).click()

  await expect.poll(async () => {
    const snapshot = await adminDb().collection('companies').where('name', '==', name).get()
    return snapshot.size
  }).toBe(1)
})
