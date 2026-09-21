import { expect } from '@playwright/test'
import { latestSignInLink } from './emulator.js'

export const STUDENT_EMAIL = 'etudiant.e2e@groupe-esigelec.org'

// Demande le lien de vérification depuis l'étape "Vérification" du
// formulaire d'ajout (déjà ouvert), puis l'ouvre comme le ferait l'étudiant
// depuis sa boîte mail : l'app se recharge, finalise la connexion et rouvre
// le formulaire, cette fois avec l'email marqué comme vérifié.
export async function verifyStudent(page, email = STUDENT_EMAIL) {
  await page.locator('#student-email').fill(email)
  await page.getByRole('button', { name: 'Envoyer le lien de vérification' }).click()
  await expect(page.getByText('Un lien de vérification a été envoyé à')).toBeVisible()

  let link
  await expect.poll(async () => {
    link = await latestSignInLink(email)
    return link
  }).toBeTruthy()

  await page.goto(link)
  await expect(page.getByText('Email étudiant vérifié :')).toBeVisible()
}
