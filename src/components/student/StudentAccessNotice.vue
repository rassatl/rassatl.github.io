<script setup>
import { inject } from 'vue'
import { useLoginModal } from '../../composables/useLoginModal.js'

// Invite à se connecter (ou créer un compte) via le panneau de connexion
// global de la sidebar, plutôt que d'embarquer un formulaire ici : la
// connexion elle-même (identifiants, inscription, vérification d'email,
// message d'erreur) vit dans un seul endroit (LoginForm.vue), quel que soit
// l'endroit d'où l'accès étudiant est demandé (formulaire d'ajout, contacts
// d'une fiche d'entreprise).
const t = inject('t')
const { open } = useLoginModal()
</script>

<template>
  <div class="student-access-notice">
    <p>{{ t('addCompanyForm.studentNotConnectedHint') }}</p>
    <button type="button" class="open-login-button" @click="open">{{ t('login.openButton') }}</button>
  </div>
</template>

<style scoped>
.student-access-notice p {
  font-size: 0.9em;
  color: var(--gray-dark);
  margin: 0 0 10px 0;
}

.open-login-button {
  background-color: var(--red-esigelec);
  color: var(--white);
  border: none;
  border-radius: 6px;
  padding: 9px;
  width: 100%;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.open-login-button:hover {
  background-color: var(--red-btn-hover);
}
</style>
