import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import 'leaflet/dist/leaflet.css'
import { useLang } from './composables/useLang.js'
import { useErrorLogs } from './composables/useErrorLogs.js'

const app = createApp(App)

const lang = useLang()
app.provide('t', lang.t)
app.provide('changeLang', lang.changeLang)
app.provide('currentLang', lang.currentLang)

// Filet de sécurité : journalise toute erreur qui remonterait sans avoir été
// traitée (et journalée) plus près de sa source par un composable/composant
// (voir les appels directs à useErrorLogs dans leurs catch).
const { logError } = useErrorLogs()
app.config.errorHandler = (err, instance, info) => {
  console.error(err)
  logError(err, `vue:${info}`)
}
window.addEventListener('error', (event) => {
  logError(event.error ?? event.message, 'window:error')
})
window.addEventListener('unhandledrejection', (event) => {
  logError(event.reason, 'window:unhandledrejection')
})

app.mount('#app')