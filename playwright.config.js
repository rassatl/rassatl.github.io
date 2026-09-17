import { defineConfig, devices } from '@playwright/test'

const PORT = 5183
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.js',
  // Tous les tests partagent un seul émulateur Firestore (voir
  // e2e/fixtures/emulator.js) : les faire tourner en parallèle ferait
  // interférer les seeds/assertions des uns avec les autres. La suite reste
  // petite pour l'instant, la série est donc largement assez rapide.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      // Émulateurs Firestore + Auth (voir firebase.json) : firestore.rules
      // s'applique réellement, ce qui est tout l'intérêt de ces tests par
      // rapport aux tests unitaires (qui mockent Firebase).
      command: 'npx firebase emulators:start --only firestore,auth --project demo-find-my-company',
      url: 'http://127.0.0.1:8080/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
    },
    {
      // Serveur de dev Vite en mode "e2e" (voir .env.e2e) : un port dédié,
      // différent de celui d'un `npm run dev` classique, pour ne jamais
      // réutiliser par erreur un serveur pointant sur le vrai Firebase.
      // --host 127.0.0.1 explicite : par défaut Vite écoute en IPv6
      // seulement sur certaines configurations Windows, ce qui rend le
      // serveur injoignable en IPv4 (et donc la sonde de webServer.url
      // ci-dessous, ainsi que toute requête Playwright) sans jamais lever
      // d'erreur claire, juste un timeout.
      command: `npm run dev -- --mode e2e --port ${PORT} --strictPort --host 127.0.0.1`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'pipe',
    },
  ],
})
