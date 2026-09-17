<script setup>
import { ref, computed, inject, onMounted, onUnmounted } from 'vue'
import Modal from '../common/Modal.vue'
import ReportIssueForm from './ReportIssueForm.vue'

const t = inject('t')
const currentLang = inject('currentLang')
const isOpen = ref(false)
const isReportOpen = ref(false)
const root = ref(null)

const formattedDate = computed(() => {
  const lang = currentLang?.currentLang ?? 'fr'
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fr-FR', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(__LAST_UPDATED__))
  } catch {
    return __LAST_UPDATED__
  }
})

const toggle = () => { isOpen.value = !isOpen.value }
const close = () => { isOpen.value = false }

// Ouvrir le formulaire de signalement referme d'abord l'infobulle : sinon
// elle resterait affichée derrière la modale (Teleport dans <body>).
const openReport = () => {
  close()
  isReportOpen.value = true
}
const closeReport = () => { isReportOpen.value = false }

// Sur tactile, il n'y a pas de mouseleave pour refermer le tooltip : un tap
// n'importe où ailleurs sur la page doit donc le faire.
const onDocumentClick = (event) => {
  if (isOpen.value && root.value && !root.value.contains(event.target)) {
    close()
  }
}
onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <div ref="root" class="site-info" @mouseleave="close">
    <button
      type="button"
      class="info-button"
      :aria-expanded="isOpen"
      :aria-label="t('siteInfo.label')"
      @click="toggle"
    >i</button>
    <div v-if="isOpen" class="info-tooltip">
      <p>{{ t('siteInfo.lastUpdated') }}</p>
      <p class="date">{{ formattedDate }}</p>
      <button type="button" class="report-issue-button" @click="openReport">{{ t('reportIssue.openButton') }}</button>
    </div>
  </div>

  <Modal :isOpen="isReportOpen" @close="closeReport">
    <ReportIssueForm @close="closeReport" />
  </Modal>
</template>

<style scoped>
.site-info {
  position: fixed;
  top: 12px;
  right: 12px;
  /* En dessous de la sidebar (z-index:800, voir ListeDeroulante.vue) : sur
     mobile celle-ci occupe presque toute la largeur de l'écran quand elle
     est ouverte et son bouton "+" est en haut à droite, au même endroit
     que ce badge. */
  z-index: 750;
}

.info-button {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid var(--red-esigelec);
  color: var(--red-esigelec);
  font-family: Georgia, 'Times New Roman', serif;
  font-style: italic;
  font-weight: bold;
  font-size: 14px;
  line-height: 1;
  padding: 0;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}

.info-button:hover {
  background: var(--red-esigelec);
  color: var(--white);
}

.info-tooltip {
  position: absolute;
  /* top:100% (et non un décalage en px) colle le tooltip juste sous le
     bouton, sans le moindre espace entre les deux : un espace, même petit,
     crée une zone morte où la souris n'est plus au-dessus d'aucun élément
     de .site-info, ce qui déclenche le mouseleave du conteneur et referme
     le tooltip avant que la souris n'y arrive (cf. rapport utilisateur). */
  top: 100%;
  right: 0;
  background: rgba(255, 255, 255, 0.97);
  color: var(--gray-dark);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  padding: 8px 12px;
  white-space: nowrap;
  font-size: 0.8em;
}

.info-tooltip p {
  margin: 0;
}

.info-tooltip .date {
  font-weight: 600;
  color: var(--red-esigelec);
  margin-top: 2px;
}

.report-issue-button {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 6px 10px;
  background: transparent;
  color: var(--red-esigelec);
  border: 1.5px solid var(--red-esigelec);
  border-radius: 6px;
  font-size: 0.85em;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.report-issue-button:hover {
  background-color: var(--red-esigelec);
  color: var(--white);
}

@media (max-width: 480px) {
  .site-info {
    top: 8px;
    right: 8px;
  }
  /* Cible tactile d'au moins 44px (recommandation Apple/Google), au lieu
     des 26px pensés pour un clic souris précis. */
  .info-button {
    width: 44px;
    height: 44px;
    font-size: 18px;
  }
  .info-tooltip {
    right: 0;
    white-space: normal;
    width: max-content;
    max-width: min(85vw, 300px);
    font-size: 0.85em;
  }
}
</style>
