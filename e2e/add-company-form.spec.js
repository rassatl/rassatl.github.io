import { test, expect } from '@playwright/test'
import { mockNominatim } from './fixtures/nominatim.js'
import { adminDb } from './fixtures/emulator.js'

const RUN_ID = crypto.randomUUID().slice(0, 8)
const COMPANY_NAME = `E2E Wizard Co ${RUN_ID}`

test("un visiteur peut soumettre une proposition d'entreprise via l'assistant", async ({ page }) => {
  await mockNominatim(page, { country: 'France' })
  await page.goto('/')

  await page.getByRole('button', { name: 'Ajouter' }).click()

  // Étape 1 : entreprise
  await page.locator('#speciality').selectOption({ label: 'IA & Big Data' })
  await page.locator('#name').fill(COMPANY_NAME)
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

  const contacts = await snapshot.docs[0].ref.collection('contacts').get()
  expect(contacts.size).toBe(1)
  expect(contacts.docs[0].data().email).toBe('camille.durand@example.com')
})
