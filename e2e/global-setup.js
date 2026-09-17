import { clearFirestore, ensureAdminUser } from './fixtures/emulator.js'

// Exécuté une seule fois, après que les émulateurs Firebase et le serveur
// Vite (voir webServer dans playwright.config.js) sont prêts, avant tous les
// tests : repart d'un état Firestore propre et garantit qu'un compte admin
// existe pour les tests qui se connectent (voir e2e/admin.spec.js).
export default async function globalSetup() {
  await clearFirestore()
  await ensureAdminUser()
}
