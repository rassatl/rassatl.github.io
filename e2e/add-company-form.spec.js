import { test, expect } from '@playwright/test'
import { mockNominatim } from './fixtures/nominatim.js'
import { adminDb } from './fixtures/emulator.js'
import { verifyStudent, STUDENT_EMAIL } from './fixtures/student.js'

const RUN_ID = crypto.randomUUID().slice(0, 8)
const COMPANY_NAME = `E2E Wizard Co ${RUN_ID}`

// Ouvre le formulaire, vérifie l'email étudiant (étape 1), remplit l'étape
// entreprise et passe à l'étape contact. `showEmail` coche la case qui
// autorise à afficher l'email de l'étudiant sur la fiche de l'entreprise.
async function fillCompanyStep(page, name, { showEmail = false } = {}) {
  await mockNominatim(page, { country: 'France' })
  await page.goto('/')

  await page.getByRole('button', { name: 'Ajouter' }).click()
  await verifyStudent(page)
  if (showEmail) await page.getByLabel("Afficher mon email étudiant sur la fiche de l'entreprise").check()
  await page.getByRole('button', { name: 'Suivant' }).click()

  await page.locator('#speciality').selectOption({ label: 'IA & Big Data' })
  await page.locator('#name').fill(name)
  await page.locator('#country').selectOption({ label: 'France' })
  await page.getByRole('tab', { name: 'Champs détaillés' }).click()
  await page.locator('#address').fill('10 rue de la République')
  await page.locator('#city').fill('Lyon')
  await page.locator('#pc').fill('69000')
  // Place le repère directement sur la mini-carte plutôt que de compter sur
  // le géocodage automatique (mocké pour ne renvoyer aucun résultat, voir
  // mockNominatim) : le point exact n'importe pas, seul compte le pays
  // renvoyé par la vérification finale (également mocké).
  await page.locator('.mini-map-wrapper .mini-map').click()
  await page.getByRole('button', { name: 'Suivant' }).click()
}

test("un visiteur peut soumettre une proposition d'entreprise via l'assistant", async ({ page }) => {
  await fillCompanyStep(page, COMPANY_NAME)

  // Étape 2 : contact
  await page.locator('#contact-firstName-0').fill('Camille')
  await page.locator('#contact-lastName-0').fill('Durand')
  await page.locator('#contact-role-0').fill('Recruteuse')
  await page.locator('#contact-email-0').fill('camille.durand@example.com')
  await page.getByRole('button', { name: 'Suivant' }).click()

  // Étape 3 : mission
  await page.locator('#mission').fill("Développement d'un module de reporting interne.")
  await page.getByRole('button', { name: 'Suivant' }).click()

  // Étape 4 : avis (facultatif, laissé vide) puis soumission finale
  await page.getByRole('button', { name: "Ajouter l'entreprise" }).click()

  await expect(page.getByRole('heading', { name: 'Proposition envoyée' })).toBeVisible()

  const snapshot = await adminDb().collection('pendingCompanies').where('name', '==', COMPANY_NAME).get()
  expect(snapshot.size).toBe(1)
  const pending = snapshot.docs[0].data()
  expect(pending.city).toBe('Lyon')
  expect(pending.speciality).toBe('IA & Big Data')
  expect(pending.mission).toContain('reporting')
  // L'email étudiant vérifié est conservé sur la proposition (pour savoir
  // qui l'a ajoutée), jamais sur l'entreprise publiée.
  expect(pending.submittedBy).toBe(STUDENT_EMAIL)
  // Privé par défaut : l'étudiant n'a rien coché.
  expect(pending.submitterVisible).toBe(false)

  const contacts = await snapshot.docs[0].ref.collection('contacts').get()
  expect(contacts.size).toBe(1)
  expect(contacts.docs[0].data().email).toBe('camille.durand@example.com')
})

test("le contact est facultatif : une proposition peut être soumise sans", async ({ page }) => {
  const name = `${COMPANY_NAME} sans contact`
  await fillCompanyStep(page, name)

  // Étape 2 : contact laissé vide
  await page.getByRole('button', { name: 'Suivant' }).click()

  // Étape 3 : mission
  await page.locator('#mission').fill("Développement d'un module de reporting interne.")
  await page.getByRole('button', { name: 'Suivant' }).click()

  // Étape 4 : avis (facultatif, laissé vide) puis soumission finale
  await page.getByRole('button', { name: "Ajouter l'entreprise" }).click()

  await expect(page.getByRole('heading', { name: 'Proposition envoyée' })).toBeVisible()

  const snapshot = await adminDb().collection('pendingCompanies').where('name', '==', name).get()
  expect(snapshot.size).toBe(1)
  const contacts = await snapshot.docs[0].ref.collection('contacts').get()
  expect(contacts.size).toBe(0)
})

test("l'étudiant peut choisir d'afficher son email sur la fiche de l'entreprise", async ({ page }) => {
  const name = `${COMPANY_NAME} email visible`
  await fillCompanyStep(page, name, { showEmail: true })

  await page.getByRole('button', { name: 'Suivant' }).click()
  await page.locator('#mission').fill("Développement d'un module de reporting interne.")
  await page.getByRole('button', { name: 'Suivant' }).click()
  await page.getByRole('button', { name: "Ajouter l'entreprise" }).click()

  await expect(page.getByRole('heading', { name: 'Proposition envoyée' })).toBeVisible()

  const snapshot = await adminDb().collection('pendingCompanies').where('name', '==', name).get()
  expect(snapshot.size).toBe(1)
  expect(snapshot.docs[0].data().submitterVisible).toBe(true)
})
