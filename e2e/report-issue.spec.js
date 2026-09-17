import { test, expect } from '@playwright/test'
import { adminDb } from './fixtures/emulator.js'

test('un visiteur peut signaler un problème', async ({ page }) => {
  const description = `Le filtre de spécialité ne réagit plus - E2E ${crypto.randomUUID().slice(0, 8)}`

  await page.goto('/')
  await page.getByRole('button', { name: 'Informations sur le site' }).click()
  await page.getByRole('button', { name: 'Signaler un problème' }).click()

  await page.locator('#issue-description').fill(description)
  await page.getByRole('button', { name: 'Envoyer' }).click()

  await expect(page.getByRole('heading', { name: 'Signalement envoyé' })).toBeVisible()

  const snapshot = await adminDb().collection('tickets').where('description', '==', description).get()
  expect(snapshot.size).toBe(1)
  const ticket = snapshot.docs[0].data()
  expect(ticket.status).toBe('open')
  expect(ticket.pageUrl).toBeTruthy()
  expect(ticket.userAgent).toBeTruthy()
})
