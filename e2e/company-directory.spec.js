import { test, expect } from '@playwright/test'
import { seedCompany, seedConfidentialContact } from './fixtures/seed.js'
import { signUpAndVerifyStudent } from './fixtures/student.js'

const DLTQ = 'Développement Logiciel, Tests et Qualité'
const IABD = 'IA & Big Data'
const RUN_ID = crypto.randomUUID().slice(0, 8)

const devCompanyName = `E2E Dev Solutions ${RUN_ID}`
const iaCompanyName = `E2E Insights AI ${RUN_ID}`
const confidentialCity = `E2E Confidential City ${RUN_ID}`

test.beforeAll(async () => {
  await seedCompany({
    speciality: DLTQ,
    name: devCompanyName,
    address: '1 rue de Test',
    city: 'Paris',
    country: 'France',
    pc: '75001',
    x: 48.8566,
    y: 2.3522,
    mission: "Développement d'une plateforme interne de suivi des stages.",
  })

  await seedCompany({
    speciality: IABD,
    name: iaCompanyName,
    address: '2 avenue de Test',
    city: 'Lyon',
    country: 'France',
    pc: '69000',
    x: 45.7640,
    y: 4.8357,
    mission: 'Mise en place d\'un pipeline de données pour un projet de recommandation.',
    review: { rating: 4, comment: 'Très bonne ambiance et missions formatrices.' },
    // Étudiant qui a choisi d'afficher son email sur la fiche.
    addedBy: 'etudiant.visible@groupe-esigelec.org',
  }, [
    {
      firstName: 'Alice',
      lastName: 'Martin',
      role: 'Tech Lead',
      email: 'alice.martin@example.com',
      phone: '',
      hidden: false,
      hideToken: 'e2e-hide-token-alice-0123456789',
    },
  ])

  // Une entreprise du format confidentiel (ajoutée par un visiteur non
  // connecté) : ni nom, ni adresse, ni contacts « d'entreprise », mais un
  // moyen de joindre l'étudiant qui l'a déposée, réservé aux étudiants
  // vérifiés comme les contacts du format complet.
  const confidentialCompanyId = await seedCompany({
    speciality: IABD,
    city: confidentialCity,
    country: 'France',
    x: 43.6047,
    y: 1.4442,
    review: { missionFeeling: 'Mission très formatrice.', housingFeeling: 'Studio trouvé via le CROUS.' },
  })
  await seedConfidentialContact('companies', confidentialCompanyId, { whatsapp: '+33 6 98 76 54 32' })
})

test('affiche les entreprises publiées et leurs détails', async ({ page }) => {
  await page.goto('/')

  const devItem = page.locator('.company-item', { hasText: devCompanyName })
  const iaItem = page.locator('.company-item', { hasText: iaCompanyName })
  await expect(devItem).toBeVisible()
  await expect(iaItem).toBeVisible()

  await iaItem.click()

  const modal = page.locator('.modal-content')
  await expect(modal.getByRole('heading', { name: iaCompanyName })).toBeVisible()
  await expect(modal.getByText('Mise en place d\'un pipeline de données', { exact: false })).toBeVisible()
  await expect(modal.getByRole('button', { name: '4 / 5' })).toBeVisible()
  await expect(modal.getByText('Ajoutée par', { exact: false })).toBeVisible()
  await expect(modal.getByText('etudiant.visible@groupe-esigelec.org')).toBeVisible()
})

test("les contacts sont réservés aux étudiants : un visiteur ne les voit pas", async ({ page }) => {
  await page.goto('/')
  await page.locator('.company-item', { hasText: iaCompanyName }).click()

  const modal = page.locator('.modal-content')
  await expect(modal.getByRole('heading', { name: iaCompanyName })).toBeVisible()
  await expect(modal.getByText('Les contacts sont réservés aux étudiants')).toBeVisible()
  await expect(modal.getByRole('button', { name: 'Se connecter / Créer un compte' })).toBeVisible()
  await expect(modal).not.toContainText('Alice Martin')
  await expect(modal).not.toContainText('alice.martin@example.com')
})

test("un étudiant qui se connecte depuis la fiche voit alors les contacts, et le reste après rechargement", async ({ page }) => {
  await page.goto('/')
  await page.locator('.company-item', { hasText: iaCompanyName }).click()

  const modal = page.locator('.modal-content')
  await modal.getByRole('button', { name: 'Se connecter / Créer un compte' }).click()
  await signUpAndVerifyStudent(page)
  // Referme le panneau de connexion (au-dessus de la fiche) pour révéler les
  // contacts, désormais accessibles.
  await page.locator('.modal-overlay').last().locator('.modal-close').click()

  await expect(modal.getByRole('heading', { name: iaCompanyName })).toBeVisible()
  await expect(modal.getByText('Alice Martin', { exact: false })).toBeVisible()
  await expect(modal.getByRole('link', { name: 'alice.martin@example.com' })).toBeVisible()

  // La session est conservée : les contacts restent visibles après rechargement.
  await page.reload()
  await page.locator('.company-item', { hasText: iaCompanyName }).click()
  await expect(page.locator('.modal-content').getByText('Alice Martin', { exact: false })).toBeVisible()
})

test("n'affiche aucun auteur quand l'étudiant a choisi de rester privé", async ({ page }) => {
  await page.goto('/')
  await page.locator('.company-item', { hasText: devCompanyName }).click()

  const modal = page.locator('.modal-content')
  await expect(modal.getByRole('heading', { name: devCompanyName })).toBeVisible()
  await expect(modal).not.toContainText('Ajoutée par')
})

test('une entreprise confidentielle affiche uniquement spécialité/ville/pays et son avis personnel', async ({ page }) => {
  await page.goto('/')
  await page.locator('.company-item', { hasText: confidentialCity }).click()

  const modal = page.locator('.modal-content')
  await expect(modal.getByRole('heading', { name: IABD })).toBeVisible()
  await expect(modal.getByText(confidentialCity)).toBeVisible()
  await expect(modal.getByText('Mission très formatrice.')).toBeVisible()
  await expect(modal.getByText('Studio trouvé via le CROUS.')).toBeVisible()
})

test("le moyen de contact d'une entreprise confidentielle est réservé aux étudiants vérifiés", async ({ page }) => {
  await page.goto('/')
  await page.locator('.company-item', { hasText: confidentialCity }).click()

  const modal = page.locator('.modal-content')
  await expect(modal.getByText('Les contacts sont réservés aux étudiants')).toBeVisible()
  await expect(modal).not.toContainText('+33 6 98 76 54 32')

  await modal.getByRole('button', { name: 'Se connecter / Créer un compte' }).click()
  await signUpAndVerifyStudent(page)
  await page.locator('.modal-overlay').last().locator('.modal-close').click()

  await expect(modal.getByText('+33 6 98 76 54 32')).toBeVisible()
})

test('le filtre de spécialité ne montre que la spécialité choisie', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('.company-item', { hasText: devCompanyName })).toBeVisible()
  await expect(page.locator('.company-item', { hasText: iaCompanyName })).toBeVisible()

  await page.locator('#speciality-select').selectOption({ label: IABD })

  await expect(page.locator('.company-item', { hasText: iaCompanyName })).toBeVisible()
  await expect(page.locator('.company-item', { hasText: devCompanyName })).not.toBeVisible()
})
