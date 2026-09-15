import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { execSync } from 'node:child_process'

// Date du dernier commit au moment du build, affichée dans le petit badge
// d'info du site. Fallback sur l'heure du build si git n'est pas dispo.
const getLastUpdated = () => {
  try {
    return execSync('git log -1 --format=%cI').toString().trim()
  } catch {
    return new Date().toISOString()
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Déployé sur le dépôt utilisateur rassatl.github.io, servi à la racine
  // du domaine (pas de sous-chemin sensible à la casse).
  base: '/',
  plugins: [vue()],
  define: {
    __LAST_UPDATED__: JSON.stringify(getLastUpdated()),
  },
})
