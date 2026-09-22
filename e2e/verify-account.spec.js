import { test, expect } from '@playwright/test'
import { adminDb } from './fixtures/emulator.js'

const RUN_ID = crypto.randomUUID().slice(0, 8)

// Le lien de vérification de compte est envoyé par email (EmailJS), ouvert
// sans être connecté : la connaissance du jeton suffit (voir firestore.rules,
// collections studentAccounts/emailVerificationTokens), comme pour
// hideToken (voir hide-contact.spec.js).
test('un lien de vérification valide confirme le compte', async ({ page }) => {
  const uid = `e2e-verify-${RUN_ID}`
  const token = `e2e-verify-token-${RUN_ID}-0123456789`
  const email = `verify.${RUN_ID}@groupe-esigelec.org`
  await adminDb().collection('studentAccounts').doc(uid).set({ email, emailVerified: false })
  await adminDb().collection('emailVerificationTokens').doc(uid).set({
    email, token, verified: false, createdAt: new Date(),
  })

  await page.goto(`/?verifyAccount=${uid}:${token}`)

  await expect(page.getByText('Votre adresse email a été confirmée. Vous pouvez maintenant vous connecter.')).toBeVisible()
  await expect.poll(async () => (await adminDb().collection('studentAccounts').doc(uid).get()).data().emailVerified).toBe(true)
})

test('un lien avec un mauvais jeton est refusé, sans vérifier le compte', async ({ page }) => {
  const uid = `e2e-verify-bad-${RUN_ID}`
  const email = `verify.bad.${RUN_ID}@groupe-esigelec.org`
  await adminDb().collection('studentAccounts').doc(uid).set({ email, emailVerified: false })
  await adminDb().collection('emailVerificationTokens').doc(uid).set({
    email, token: `e2e-real-token-${RUN_ID}-0123456789`, verified: false, createdAt: new Date(),
  })

  await page.goto(`/?verifyAccount=${uid}:un-mauvais-jeton-0123456789`)

  await expect(page.getByText('Ce lien est invalide ou a déjà été utilisé.')).toBeVisible()
  expect((await adminDb().collection('studentAccounts').doc(uid).get()).data().emailVerified).toBe(false)
})

test('un lien déjà utilisé affiche que le compte est déjà vérifié', async ({ page }) => {
  const uid = `e2e-verify-done-${RUN_ID}`
  const token = `e2e-verify-token-done-${RUN_ID}-0123456789`
  const email = `verify.done.${RUN_ID}@groupe-esigelec.org`
  await adminDb().collection('studentAccounts').doc(uid).set({ email, emailVerified: true })
  await adminDb().collection('emailVerificationTokens').doc(uid).set({
    email, token, verified: true, createdAt: new Date(),
  })

  await page.goto(`/?verifyAccount=${uid}:${token}`)

  await expect(page.getByText('Ce compte est déjà vérifié. Vous pouvez vous connecter.')).toBeVisible()
})
