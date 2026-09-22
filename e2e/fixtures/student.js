import { expect } from '@playwright/test'
import { markEmailVerified } from './emulator.js'

export const STUDENT_PASSWORD = 'e2e-Student-Password-123!'

// Génère une adresse étudiante unique à cet appel : l'émulateur Auth n'est
// pas réinitialisé entre les tests d'un même fichier, une adresse fixe
// ferait donc échouer toute inscription après la première ("email déjà
// utilisé").
export function uniqueStudentEmail() {
  return `etudiant.e2e.${crypto.randomUUID().slice(0, 8)}@groupe-esigelec.org`
}

// Depuis le panneau de connexion déjà ouvert (peu importe d'où : icône de la
// sidebar, ou le bouton "Se connecter / Créer un compte" affiché à la place
// des contacts / de l'étape de vérification) : crée un compte étudiant,
// simule la vérification de l'email (voir markEmailVerified — le lien mène à
// une page hébergée par Firebase, hors de notre application ; il n'y a donc
// rien de plus à tester côté app que la lecture du résultat), puis se
// reconnecte avec ce compte. Renvoie l'email utilisé (généré si omis).
export async function signUpAndVerifyStudent(page, { email = uniqueStudentEmail(), password = STUDENT_PASSWORD } = {}) {
  await page.getByRole('button', { name: 'Pas encore de compte ? Créez-en un maintenant' }).click()
  await page.locator('#signup-email').fill(email)
  await page.locator('#signup-password').fill(password)
  await page.locator('#signup-confirm-password').fill(password)
  await page.getByRole('button', { name: 'Créer le compte' }).click()
  await expect(page.getByRole('heading', { name: 'Compte créé !' })).toBeVisible()

  await markEmailVerified(email)

  await page.getByRole('button', { name: 'Retour à la connexion' }).click()
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  // Un titre précisément (pas juste le texte, que StudentStep peut afficher
  // en même temps dans la modale du dessous, une fois l'étudiant reconnu).
  await expect(page.getByRole('heading', { name: "Connecté en tant qu'étudiant vérifié" })).toBeVisible()

  return email
}
