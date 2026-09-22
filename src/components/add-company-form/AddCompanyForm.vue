<script setup>
import { ref, computed } from 'vue'
import { useAuth } from '../../composables/useAuth.js'
import FullCompanyForm from './FullCompanyForm.vue'
import ConfidentialCompanyForm from './ConfidentialCompanyForm.vue'

// Choisit le bon formulaire selon qui ajoute :
// - un admin ou un étudiant connecté (vérifié) a accès au formulaire complet
//   (nom, adresse, site web, contacts, mission) par défaut ;
// - un visiteur non connecté n'a accès qu'au formulaire confidentiel minimal
//   (spécialité, pays, ville), toujours totalement anonyme.
// Un étudiant connecté peut malgré tout choisir le formulaire confidentiel à
// la place (wantsConfidential, basculé depuis l'un ou l'autre formulaire) :
// c'est alors exactement le même formulaire que celui d'un visiteur non
// connecté, tout aussi anonyme (voir firestore.rules, qui autorise ce format
// sans attribution quel que soit l'état de connexion de l'auteur de la
// requête). Un admin n'a pas ce choix : le formulaire confidentiel ne lui
// sert à rien (ajout direct, pas de proposition en attente).
// En mode révision (une proposition existante), le format suit celui de la
// proposition elle-même (repéré par la présence du champ "name", absent
// d'une proposition confidentielle) plutôt que l'état de connexion de
// l'admin qui la relit.
const props = defineProps({ pendingCompany: { type: Object, default: null } });
const emit = defineEmits(['refresh', 'close']);

const { isAdmin, studentEmail } = useAuth();

const wantsConfidential = ref(false);

const isFullMode = computed(() => {
  if (props.pendingCompany) return 'name' in props.pendingCompany;
  if (wantsConfidential.value) return false;
  return isAdmin.value || !!studentEmail.value;
});

// Le choix n'a de sens que pour un étudiant connecté sur une nouvelle
// soumission : un visiteur non connecté n'a que le formulaire confidentiel,
// un admin que le formulaire complet, et le mode révision suit la
// proposition existante.
const canSwitchMode = computed(() => !props.pendingCompany && !isAdmin.value && !!studentEmail.value);
</script>

<template>
  <FullCompanyForm
    v-if="isFullMode"
    :pending-company="pendingCompany"
    :can-switch-to-confidential="canSwitchMode"
    @refresh="emit('refresh')"
    @close="emit('close')"
    @switch-to-confidential="wantsConfidential = true"
  />
  <ConfidentialCompanyForm
    v-else
    :pending-company="pendingCompany"
    :can-switch-to-full="canSwitchMode"
    @refresh="emit('refresh')"
    @close="emit('close')"
    @switch-to-full="wantsConfidential = false"
  />
</template>
