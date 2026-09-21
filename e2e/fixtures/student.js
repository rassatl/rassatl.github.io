import { expect } from '@playwright/test'
import { latestSignInLink } from './emulator.js'

export const STUDENT_EMAIL = 'etudiant.e2e@groupe-esigelec.org'

// Demande le lien de vérification depuis un champ email déjà affiché (étape
// "Vérification" du formulaire d'ajout, ou contacts d'une fiche d'entreprise),
// et renvoie ce lien lu dans l'émulateur Auth : c'est ce que l'étudiant
// recevrait dans sa boîte mail.
export async function requestStudentLink(page, email = STUDENT_EMAIL, inputSelector = '#student-email') {
  await page.locator(inputSelector).fill(email)
  await page.getByRole('button', { name: 'Envoyer le lien de vérification' }).click()
  await expect(page.getByText('Un lien de vérification a été envoyé à')).toBeVisible()

  let link
  await expect.poll(async () => {
    link = await latestSignInLink(email)
    return link
  }).toBeTruthy()
  return link
}

// Depuis l'étape "Vérification" du formulaire d'ajout (déjà ouvert) : demande
// le lien puis l'ouvre comme le ferait l'étudiant depuis sa boîte mail. L'app
// se recharge, finalise la connexion et rouvre le formulaire, cette fois avec
// l'email marqué comme vérifié.
export async function verifyStudent(page, email = STUDENT_EMAIL) {
  const link = await requestStudentLink(page, email)
  await page.goto(link)
  await expect(page.getByText('Email étudiant vérifié :')).toBeVisible()
}
