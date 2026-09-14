import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  // Déployé sur le dépôt utilisateur rassatl.github.io, servi à la racine
  // du domaine (pas de sous-chemin sensible à la casse).
  base: '/',
  plugins: [vue()],
})
