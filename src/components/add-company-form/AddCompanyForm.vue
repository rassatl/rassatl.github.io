<script setup>
import { computed } from 'vue'
import { useAuth } from '../../composables/useAuth.js'
import FullCompanyForm from './FullCompanyForm.vue'
import ConfidentialCompanyForm from './ConfidentialCompanyForm.vue'

// Choisit le bon formulaire selon qui ajoute :
// - un admin ou un étudiant connecté (vérifié) a accès au formulaire complet
//   (nom, adresse, site web, contacts, mission) ;
// - un visiteur non connecté n'a accès qu'au formulaire confidentiel minimal
//   (spécialité, pays, ville), toujours totalement anonyme.
// En mode révision (une proposition existante), le format suit celui de la
// proposition elle-même (repéré par la présence du champ "name", absent
// d'une proposition confidentielle) plutôt que l'état de connexion de
// l'admin qui la relit.
const props = defineProps({ pendingCompany: { type: Object, default: null } });
const emit = defineEmits(['refresh', 'close']);

const { isAdmin, studentEmail } = useAuth();

const isFullMode = computed(() => {
  if (props.pendingCompany) return 'name' in props.pendingCompany;
  return isAdmin.value || !!studentEmail.value;
});
</script>

<template>
  <FullCompanyForm v-if="isFullMode" :pending-company="pendingCompany" @refresh="emit('refresh')" @close="emit('close')" />
  <ConfidentialCompanyForm v-else :pending-company="pendingCompany" @refresh="emit('refresh')" @close="emit('close')" />
</template>
