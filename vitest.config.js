import { defineConfig, configDefaults } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    // Le pattern par défaut de Vitest matche aussi *.spec.js, qui est celui
    // des tests end-to-end Playwright (voir e2e/, lancés séparément avec
    // `npm run test:e2e`) : sans cette exclusion, Vitest essaie de les
    // exécuter lui-même et échoue (test()/test.beforeAll() de Playwright
    // appelés hors de son propre runner).
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
