import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './fixtures/login.js'
import { latestSignInLink } from './fixtures/emulator.js'

test.describe("vérification de l'email étudiant dans le formulaire d'ajout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Ajouter' }).click()
  })

  test("la vérification est la première étape et précise que l'email n'est pas affiché", async ({ page }) => {
    await expect(page.locator('#student-email')).toBeVisible()
    await expect(page.getByText("Cet email ne sera pas affiché sur le site, sauf si vous le choisissez")).toBeVisible()
    // L'affichage de l'email est un choix explicite : décoché par défaut.
    await expect(page.getByLabel("Afficher mon email étudiant sur la fiche de l'entreprise")).not.toBeChecked()
    // L'étape entreprise n'est pas accessible tant que l'email n'est pas vérifié.
    await expect(page.locator('#speciality')).toBeHidden()
  })

  test("impossible de passer à la suite sans avoir vérifié son email", async ({ page }) => {
    await page.getByRole('button', { name: 'Suivant' }).click()

    await expect(page.getByText('Merci de vérifier votre email étudiant avant de continuer.')).toBeVisible()
    await expect(page.locator('#student-email')).toBeVisible()
    await expect(page.locator('#speciality')).toBeHidden()
  })

  test("un email hors du domaine étudiant est refusé, sans envoi de lien", async ({ page }) => {
    const email = `intrus.${crypto.randomUUID().slice(0, 8)}@gmail.com`
    await page.locator('#student-email').fill(email)
    await page.getByRole('button', { name: 'Envoyer le lien de vérification' }).click()

    await expect(page.getByText('Merci de saisir une adresse étudiante en @groupe-esigelec.org.')).toBeVisible()
    expect(await latestSignInLink(email)).toBeUndefined()
  })
})

test("un admin n'a pas à vérifier d'email étudiant pour ajouter une entreprise", async ({ page }) => {
  await page.goto('/')
  await loginAsAdmin(page)

  await page.getByRole('button', { name: 'Ajouter' }).click()

  await expect(page.locator('#speciality')).toBeVisible()
  await expect(page.locator('#student-email')).toHaveCount(0)
})
