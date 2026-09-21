import { test, expect } from '@playwright/test'
import { seedCompany } from './fixtures/seed.js'
import { adminDb } from './fixtures/emulator.js'

const RUN_ID = crypto.randomUUID().slice(0, 8)

// Le lien « masquer mes informations » est envoyé par email à un contact
// d'entreprise, qui l'ouvre sans être connecté : il doit continuer de
// fonctionner alors que la liste des contacts est réservée aux étudiants
// vérifiés (voir firestore.rules).
test('un contact peut masquer ses informations depuis son lien, sans être connecté', async ({ page }) => {
  const token = `e2e-hide-token-${RUN_ID}-0123456789`
  const companyId = await seedCompany({
    speciality: 'IA & Big Data',
    name: `E2E Hide Contact Co ${RUN_ID}`,
    address: '6 rue du Masquage',
    city: 'Nice',
    country: 'France',
    pc: '06000',
    x: 43.7102,
    y: 7.262,
    mission: 'Mission avec un contact qui se masque.',
  }, [
    {
      firstName: 'Hugo',
      lastName: 'Masque',
      role: 'Directeur technique',
      email: 'hugo.masque@example.com',
      phone: '0102030405',
      hidden: false,
      hideToken: token,
    },
  ])
  const contactsCollection = adminDb().collection('companies').doc(companyId).collection('contacts')
  const [contactDoc] = (await contactsCollection.get()).docs

  await page.goto(`/?hideContact=${companyId}:${contactDoc.id}:${token}`)

  await expect(page.getByText('Hugo Masque')).toBeVisible()
  await page.getByRole('button', { name: 'Masquer mes informations' }).click()
  await expect(page.getByText('Vos informations personnelles ont été retirées du site.')).toBeVisible()

  await expect.poll(async () => (await contactDoc.ref.get()).data().hidden).toBe(true)
  const redacted = (await contactDoc.ref.get()).data()
  expect(redacted).toMatchObject({ firstName: '', lastName: '', role: '', email: '', phone: '' })
})

test('un lien avec un mauvais jeton est refusé', async ({ page }) => {
  const companyId = await seedCompany({
    speciality: 'IA & Big Data',
    name: `E2E Hide Bad Token Co ${RUN_ID}`,
    address: '8 rue du Refus',
    city: 'Metz',
    country: 'France',
    pc: '57000',
    x: 49.1193,
    y: 6.1757,
    mission: 'Mission avec un lien invalide.',
  }, [
    {
      firstName: 'Iris',
      lastName: 'Secret',
      role: 'RH',
      email: 'iris.secret@example.com',
      phone: '',
      hidden: false,
      hideToken: `e2e-real-token-${RUN_ID}-0123456789`,
    },
  ])
  const [contactDoc] = (await adminDb().collection('companies').doc(companyId).collection('contacts').get()).docs

  await page.goto(`/?hideContact=${companyId}:${contactDoc.id}:un-mauvais-jeton-0123456789`)

  await expect(page.getByText('Ce lien est invalide ou a expiré.')).toBeVisible()
  expect((await contactDoc.ref.get()).data().hidden).toBe(false)
})
