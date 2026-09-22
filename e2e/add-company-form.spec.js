import { test, expect } from '@playwright/test'
import { mockNominatim } from './fixtures/nominatim.js'
import { adminDb } from './fixtures/emulator.js'
import { signUpAndVerifyStudent } from './fixtures/student.js'

const RUN_ID = crypto.randomUUID().slice(0, 8)
const COMPANY_NAME = `E2E Wizard Co ${RUN_ID}`

// Connecte un étudiant vérifié depuis l'icône de connexion de la sidebar
// (sans passer par le formulaire d'ajout, qui n'a plus d'étape de connexion
// intégrée) : une fois connecté, "Ajouter" donne accès au formulaire complet
// (nom, adresse, contacts, mission) plutôt qu'au formulaire confidentiel,
// réservé aux visiteurs non connectés.
async function connectAsStudent(page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Connexion' }).click()
  const email = await signUpAndVerifyStudent(page)
  await page.locator('.modal-close').click()
  await page.locator('.toggle-button').click()
  return email
}

// Remplit l'étape entreprise du formulaire complet et passe à l'étape contact.
// `showEmail` coche la case qui autorise à afficher l'email de l'étudiant sur
// la fiche de l'entreprise.
async function fillCompanyStep(page, name, { showEmail = false } = {}) {
  await page.getByRole('button', { name: 'Ajouter' }).click()
  await expect(page.getByRole('heading', { name: 'Ajouter une entreprise', exact: true })).toBeVisible()
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

test.describe('formulaire complet (étudiant connecté)', () => {
  test("un étudiant connecté peut soumettre une proposition complète via l'assistant", async ({ page }) => {
    await mockNominatim(page, { country: 'France' })
    const studentEmail = await connectAsStudent(page)
    await fillCompanyStep(page, COMPANY_NAME)

    // Étape contact
    await page.locator('#contact-firstName-0').fill('Camille')
    await page.locator('#contact-lastName-0').fill('Durand')
    await page.locator('#contact-role-0').fill('Recruteuse')
    await page.locator('#contact-email-0').fill('camille.durand@example.com')
    await page.getByRole('button', { name: 'Suivant' }).click()

    // Étape mission
    await page.locator('#mission').fill("Développement d'un module de reporting interne.")
    await page.getByRole('button', { name: 'Suivant' }).click()

    // Étape avis (facultatif, laissé vide) puis soumission finale
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
    expect(pending.submittedBy).toBe(studentEmail)
    // Privé par défaut : l'étudiant n'a rien coché.
    expect(pending.submitterVisible).toBe(false)

    const contacts = await snapshot.docs[0].ref.collection('contacts').get()
    expect(contacts.size).toBe(1)
    expect(contacts.docs[0].data().email).toBe('camille.durand@example.com')
  })

  test("le contact est facultatif : une proposition peut être soumise sans", async ({ page }) => {
    const name = `${COMPANY_NAME} sans contact`
    await mockNominatim(page, { country: 'France' })
    await connectAsStudent(page)
    await fillCompanyStep(page, name)

    // Étape contact laissée vide
    await page.getByRole('button', { name: 'Suivant' }).click()

    // Étape mission
    await page.locator('#mission').fill("Développement d'un module de reporting interne.")
    await page.getByRole('button', { name: 'Suivant' }).click()

    // Étape avis (facultatif, laissé vide) puis soumission finale
    await page.getByRole('button', { name: "Ajouter l'entreprise" }).click()

    await expect(page.getByRole('heading', { name: 'Proposition envoyée' })).toBeVisible()

    const snapshot = await adminDb().collection('pendingCompanies').where('name', '==', name).get()
    expect(snapshot.size).toBe(1)
    const contacts = await snapshot.docs[0].ref.collection('contacts').get()
    expect(contacts.size).toBe(0)
  })

  test("l'étudiant peut choisir d'afficher son email sur la fiche de l'entreprise", async ({ page }) => {
    const name = `${COMPANY_NAME} email visible`
    await mockNominatim(page, { country: 'France' })
    await connectAsStudent(page)
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
})

test.describe('formulaire confidentiel (visiteur non connecté)', () => {
  async function fillConfidentialCompanyStep(page, city) {
    await mockNominatim(page, { country: 'France' })
    await page.goto('/')

    await page.getByRole('button', { name: 'Ajouter' }).click()
    await expect(page.getByRole('heading', { name: 'Ajouter une entreprise confidentielle' })).toBeVisible()

    await page.locator('#speciality').selectOption({ label: 'IA & Big Data' })
    await page.locator('#country').selectOption({ label: 'France' })
    await page.locator('#city').fill(city)
    await page.locator('.mini-map-wrapper .mini-map').click()
    await page.getByRole('button', { name: 'Suivant' }).click()
  }

  test("un visiteur non connecté peut soumettre un point de façon anonyme, avec au moins un moyen de le contacter", async ({ page }) => {
    const city = `E2E Confidential Ville ${RUN_ID}`
    await fillConfidentialCompanyStep(page, city)

    // Étape contact : au moins un champ requis, rien n'est vérifié.
    await page.locator('#contact-personal-email').fill('ada.lovelace@example.com')
    await page.getByRole('button', { name: 'Suivant' }).click()

    await page.getByRole('button', { name: 'Ajouter le point' }).click()

    await expect(page.getByRole('heading', { name: 'Proposition envoyée' })).toBeVisible()

    const snapshot = await adminDb().collection('pendingCompanies').where('city', '==', city).get()
    expect(snapshot.size).toBe(1)
    const pending = snapshot.docs[0].data()
    expect(pending.speciality).toBe('IA & Big Data')
    expect(pending.country).toBe('France')
    expect(pending).not.toHaveProperty('name')
    expect(pending).not.toHaveProperty('submittedBy')
    expect(pending).not.toHaveProperty('submitterVisible')

    const confidentialContact = await snapshot.docs[0].ref.collection('confidentialContact').get()
    expect(confidentialContact.size).toBe(1)
    expect(confidentialContact.docs[0].data()).toEqual({ personalEmail: 'ada.lovelace@example.com' })
  })

  test("impossible d'avancer depuis l'étape contact sans remplir au moins un champ", async ({ page }) => {
    const city = `E2E Confidential Ville Sans Contact ${RUN_ID}`
    await fillConfidentialCompanyStep(page, city)

    await page.getByRole('button', { name: 'Suivant' }).click()

    await expect(page.getByText('Merci de renseigner au moins un moyen de vous contacter.').first()).toBeVisible()
  })

  test("l'avis personnel facultatif est bien enregistré quand il est rempli", async ({ page }) => {
    const city = `E2E Confidential Ville Avis ${RUN_ID}`
    await fillConfidentialCompanyStep(page, city)

    await page.locator('#contact-whatsapp').fill('+33 6 12 34 56 78')
    await page.getByRole('button', { name: 'Suivant' }).click()

    await page.locator('#review-mission').fill("Développement d'un module de reporting interne.")
    await page.locator('#review-country').fill('Facile à vivre, bon accueil.')
    await page.getByRole('button', { name: 'Ajouter le point' }).click()

    await expect(page.getByRole('heading', { name: 'Proposition envoyée' })).toBeVisible()

    const snapshot = await adminDb().collection('pendingCompanies').where('city', '==', city).get()
    expect(snapshot.size).toBe(1)
    const pending = snapshot.docs[0].data()
    expect(pending.review.missionFeeling).toContain('reporting')
    expect(pending.review.countryFeeling).toContain('accueil')
    expect(pending.review).not.toHaveProperty('housingFeeling')
  })

  test("renseigner la ville et le pays place un point par défaut au centre de la ville, sans avoir à cliquer sur la carte", async ({ page }) => {
    const city = `E2E Confidential Ville Auto ${RUN_ID}`
    await mockNominatim(page, { country: 'France', cityResult: { lat: 48.8566, lon: 2.3522 } })
    await page.goto('/')

    await page.getByRole('button', { name: 'Ajouter' }).click()
    await page.locator('#speciality').selectOption({ label: 'IA & Big Data' })
    await page.locator('#country').selectOption({ label: 'France' })
    await page.locator('#city').fill(city)

    // Aucun clic sur la carte : on attend que le géocodage (débounce inclus)
    // place le point tout seul, avant de vérifier qu'avancer ne déclenche pas
    // l'avertissement "placez un point".
    await expect(page.getByText('Glissez le repère', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Suivant' }).click()

    await page.locator('#contact-linkedin').fill('https://www.linkedin.com/in/e2e-test')
    await page.getByRole('button', { name: 'Suivant' }).click()
    await page.getByRole('button', { name: 'Ajouter le point' }).click()

    await expect(page.getByRole('heading', { name: 'Proposition envoyée' })).toBeVisible()

    const snapshot = await adminDb().collection('pendingCompanies').where('city', '==', city).get()
    expect(snapshot.size).toBe(1)
    const pending = snapshot.docs[0].data()
    expect(pending.x).toBeCloseTo(48.8566, 3)
    expect(pending.y).toBeCloseTo(2.3522, 3)
  })
})
