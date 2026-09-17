import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './fixtures/login.js'
import { mockNominatim } from './fixtures/nominatim.js'
import { seedPendingCompany } from './fixtures/seed.js'
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

test.describe('modération des propositions en attente', () => {
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
    }, [
      { firstName: 'Julien', lastName: 'Petit', role: 'Manager', email: 'julien.petit@example.com', phone: '' },
    ])

    await mockNominatim(page, { country: 'France' })
    await page.goto('/')
    await loginAsAdmin(page)

    await page.getByRole('button', { name: 'Liste des entreprises en attente' }).click()
    const item = page.locator('.pending-companies li', { hasText: name })
    await item.getByRole('button', { name: 'Modifier / Valider' }).click()

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

    const contactsSnapshot = await companySnapshot.docs[0].ref.collection('contacts').get()
    expect(contactsSnapshot.size).toBe(1)
    expect(contactsSnapshot.docs[0].data().email).toBe('julien.petit@example.com')
  })
})
