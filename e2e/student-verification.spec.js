import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './fixtures/login.js'
import { signUpAndVerifyStudent, uniqueStudentEmail, STUDENT_PASSWORD } from './fixtures/student.js'

// Depuis le pivot vers le formulaire confidentiel : se connecter n'est plus
// nécessaire pour ajouter un point (un visiteur non connecté a son propre
// formulaire minimal, voir add-company-form.spec.js), seulement pour accéder
// au formulaire complet et s'y attribuer sa proposition. Ici, on vérifie le
// panneau de connexion / inscription lui-même (ouvert depuis l'icône de la
// sidebar), et le choix de formulaire selon l'état de connexion.

test.describe('panneau de connexion / inscription (icône de la sidebar)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Connexion' }).click()
  })

  test("le bouton ouvre le panneau de connexion, avec un lien vers l'inscription", async ({ page }) => {
    await expect(page.locator('#login-email')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pas encore de compte ? Créez-en un maintenant' })).toBeVisible()
  })

  test("un email hors du domaine étudiant est refusé à l'inscription, sans créer de compte", async ({ page }) => {
    await page.getByRole('button', { name: 'Pas encore de compte ? Créez-en un maintenant' }).click()

    await page.locator('#signup-email').fill(`intrus.${crypto.randomUUID().slice(0, 8)}@gmail.com`)
    await page.locator('#signup-password').fill(STUDENT_PASSWORD)
    await page.locator('#signup-confirm-password').fill(STUDENT_PASSWORD)
    await page.getByRole('button', { name: 'Créer le compte' }).click()

    await expect(page.getByText('Merci de saisir une adresse étudiante en @groupe-esigelec.org.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Compte créé !' })).toHaveCount(0)
  })

  test("des mots de passe différents sont refusés à l'inscription", async ({ page }) => {
    await page.getByRole('button', { name: 'Pas encore de compte ? Créez-en un maintenant' }).click()

    await page.locator('#signup-email').fill(uniqueStudentEmail())
    await page.locator('#signup-password').fill(STUDENT_PASSWORD)
    await page.locator('#signup-confirm-password').fill('un-autre-mot-de-passe')
    await page.getByRole('button', { name: 'Créer le compte' }).click()

    await expect(page.getByText('Les mots de passe ne correspondent pas.')).toBeVisible()
  })

  test("tant que le lien de vérification n'a pas été cliqué, se connecter affiche l'avertissement plutôt que de laisser passer", async ({ page }) => {
    const email = uniqueStudentEmail()
    await page.getByRole('button', { name: 'Pas encore de compte ? Créez-en un maintenant' }).click()
    await page.locator('#signup-email').fill(email)
    await page.locator('#signup-password').fill(STUDENT_PASSWORD)
    await page.locator('#signup-confirm-password').fill(STUDENT_PASSWORD)
    await page.getByRole('button', { name: 'Créer le compte' }).click()
    await expect(page.getByRole('heading', { name: 'Compte créé !' })).toBeVisible()
    // L'avertissement sur les indésirables/quarantaine est déjà visible ici.
    await expect(page.getByText('quarantaine')).toBeVisible()

    await page.getByRole('button', { name: 'Retour à la connexion' }).click()
    await page.locator('#login-email').fill(email)
    await page.locator('#login-password').fill(STUDENT_PASSWORD)
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Email non vérifié' })).toBeVisible()
    await expect(page.getByText('quarantaine')).toBeVisible()
  })
})

test.describe("choix du formulaire d'ajout selon l'état de connexion", () => {
  test("un visiteur non connecté n'a accès qu'au formulaire confidentiel", async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Ajouter' }).click()

    await expect(page.getByRole('heading', { name: 'Ajouter une entreprise confidentielle' })).toBeVisible()
    await expect(page.locator('#name')).toHaveCount(0)
  })

  test("le formulaire confidentiel explique pourquoi il est minimal et propose de se connecter pour le formulaire complet", async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Ajouter' }).click()

    await expect(page.getByText('Ajout rapide et anonyme', { exact: false })).toBeVisible()
    await expect(page.getByText("Vous voulez renseigner le nom, l'adresse et les contacts", { exact: false })).toBeVisible()

    const email = await (async () => {
      await page.getByRole('button', { name: 'Se connecter / Créer un compte' }).click()
      const address = await signUpAndVerifyStudent(page)
      await page.locator('.modal-overlay').last().locator('.modal-close').click()
      return address
    })()

    // Une fois connecté, le formulaire empilé au-dessus bascule tout seul
    // vers le formulaire complet (sans avoir à rouvrir "Ajouter").
    await expect(page.getByRole('heading', { name: 'Ajouter une entreprise', exact: true })).toBeVisible()
    await expect(page.getByText(`Connecté en tant qu'étudiant vérifié :`)).toBeVisible()
    await expect(page.getByText(email)).toBeVisible()
  })

  test("une fois inscrit, vérifié et reconnecté, l'ajout donne accès au formulaire complet", async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Connexion' }).click()
    await signUpAndVerifyStudent(page)
    await page.locator('.modal-close').click()
    await page.locator('.toggle-button').click()

    await page.getByRole('button', { name: 'Ajouter' }).click()
    await expect(page.getByRole('heading', { name: 'Ajouter une entreprise', exact: true })).toBeVisible()
    // Le formulaire complet démarre sur l'étape d'attribution (l'étudiant
    // est déjà reconnu), avant l'étape entreprise où vit #name.
    await expect(page.getByText('Connecté en tant qu\'étudiant vérifié :')).toBeVisible()
    await page.getByRole('button', { name: 'Suivant' }).click()
    await expect(page.locator('#name')).toBeVisible()
  })

  test("un admin a directement accès au formulaire complet, sans passer par une connexion étudiante", async ({ page }) => {
    await page.goto('/')
    await loginAsAdmin(page)

    await page.getByRole('button', { name: 'Ajouter' }).click()
    await expect(page.getByRole('heading', { name: 'Ajouter une entreprise', exact: true })).toBeVisible()
    // Un admin n'a pas d'étape d'attribution : l'étape entreprise est la
    // première affichée.
    await expect(page.locator('#name')).toBeVisible()
  })
})
