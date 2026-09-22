import { expect } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './emulator.js'

// Connecte l'admin de test (créé par global-setup.js) via le formulaire de
// connexion de la sidebar, et attend que l'UI reflète bien l'état admin
// avant de rendre la main : les tests qui l'utilisent enchaînent
// généralement tout de suite sur une action réservée aux admins.
export async function loginAsAdmin(page) {
  // Ouvrir n'importe quelle modale depuis la sidebar la referme (voir
  // openLoginPanel dans ListeDeroulante.vue) : après la connexion, il faut
  // donc la rouvrir explicitement pour retrouver les actions admin.
  await page.getByRole('button', { name: 'Connexion' }).click()
  await page.locator('#login-email').fill(ADMIN_EMAIL)
  await page.locator('#login-password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  // Le panneau de connexion ne se ferme plus tout seul après une connexion
  // réussie (il doit pouvoir afficher "email non vérifié" à la place) : on le
  // referme donc nous-même avant de rouvrir la sidebar.
  await expect(page.getByRole('heading', { name: 'Connecté en tant qu\'administrateur' })).toBeVisible()
  await page.locator('.modal-close').click()
  await page.locator('.toggle-button').click()
  await expect(page.getByRole('button', { name: 'Connecté en tant qu\'administrateur' })).toBeVisible()
}
