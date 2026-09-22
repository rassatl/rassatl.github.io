<script setup>
import { onMounted, ref, computed, inject } from 'vue'
import { db } from '../../services/firebase'
import { collection, getDocs } from 'firebase/firestore'
import Modal from '../common/Modal.vue';
import AddCompanyForm from '../add-company-form/AddCompanyForm.vue';
import ListCompanies from './ListCompanies.vue';
import LangSwitcher from '../common/LangSwitcher.vue'
import LoginForm from '../auth/LoginForm.vue'
import PendingCompanies from './PendingCompanies.vue'
import TicketsList from './TicketsList.vue'
import { useAuth } from '../../composables/useAuth.js'
import { useLoginModal } from '../../composables/useLoginModal.js'
import { usePendingCompanies } from '../../composables/usePendingCompanies.js'
import { useTickets } from '../../composables/useTickets.js'

const isMobile = ref(false)
const listeDeroulanteWidth = ref(400)
const listeDeroulanteDefaultSize = 0

const t = inject('t')
const { isAdmin, canViewContacts } = useAuth()
const { isOpen: isLoginModalOpen, open: openLoginModal, close: closeLoginModal } = useLoginModal()
const { pendingCompanies } = usePendingCompanies()
const { openCount: openTicketsCount } = useTickets()

// Props et événements
const props = defineProps({isOpen: Boolean, visibleCompanies: Array})
const emit = defineEmits(['toggle', 'update-speciality', 'company-added'])

const isModalOpen = ref(false);
const isPendingModalOpen = ref(false);
const isTicketsModalOpen = ref(false);
const companies = ref([])
const selectedSpeciality = ref('')

// Fonction pour ouvrir la fenêtre modale d'ajout d'entreprise
const openModal = () => {
  isModalOpen.value = true;
  if (props.isOpen) {
    emit('toggle');
  }
};

// Fonction pour fermer la fenêtre modale d'ajout d'entreprise
const closeModal = () => {
  isModalOpen.value = false;
};

// L'ouverture/fermeture du panneau de connexion est gérée par useLoginModal
// (partagée avec les endroits qui exigent un compte étudiant vérifié) ; ici
// on ne fait que fermer la sidebar au clic, comme pour les autres modales.
const openLoginPanel = () => {
  openLoginModal();
  if (props.isOpen) {
    emit('toggle');
  }
};

const openPendingModal = () => {
  isPendingModalOpen.value = true;
  if (props.isOpen) {
    emit('toggle');
  }
};
const closePendingModal = () => {
  isPendingModalOpen.value = false;
};

const openTicketsModal = () => {
  isTicketsModalOpen.value = true;
  if (props.isOpen) {
    emit('toggle');
  }
};
const closeTicketsModal = () => {
  isTicketsModalOpen.value = false;
};

// Filtre pour les entreprises selon la spécialité sélectionnée 
// et la liste des entreprises visibles fournies par le composant MapView
const filteredCompanies = computed(() => {
  let base = props.visibleCompanies.length ? props.visibleCompanies : companies.value
  if (!selectedSpeciality.value || selectedSpeciality.value === 'Toutes') {
    return base
  }
  return base.filter(c =>
    c.speciality.includes(selectedSpeciality.value)
  )
})


// Fonction pour récupérer la liste des entreprises depuis Firestore
const fetchCompanies = async () => {
  const querySnapshot = await getDocs(collection(db, 'companies'));
  companies.value = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// Après l'ajout d'une entreprise : rafraîchit la liste de la sidebar et
// prévient le parent pour que la carte affiche aussi le nouveau point.
const handleCompanyAdded = async () => {
  await fetchCompanies();
  emit('company-added');
};

// Fonction pour ouvrir/fermer la sidebar
function toggleSideBar() {
  emit('toggle')
}

onMounted(() => {
  const updateSize = () => {
    isMobile.value = window.innerWidth <= 768
    // Sur mobile, la sidebar occupe (presque) tout l'écran : laisser une
    // bande de carte visible à côté n'a pas de sens sur un petit écran et
    // ne laisse pas assez de place aux données de chaque entreprise.
    listeDeroulanteWidth.value = isMobile.value ? Math.min(window.innerWidth - 24, 420) : 400
  }

  window.addEventListener('resize', updateSize)
  updateSize()
})

onMounted(fetchCompanies);
</script>

<template>
  <div>
    <div class="sidebar" :class="{ closed: !props.isOpen }" :style="{ width: props.isOpen ? listeDeroulanteWidth+'px' : listeDeroulanteDefaultSize+'px' }">

      <!-- Bouton pour se connecter (admin comme étudiant) -->
      <div v-if="props.isOpen" class="connection-action">
        <button
          @click="openLoginPanel"
          class="refresh-button"
          :class="{ 'is-connected': canViewContacts }"
          :aria-label="isAdmin ? t('login.loggedInAs') : t('login.title')"
        ><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-user"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></button>
      </div>

      <!-- Bouton pour afficher la liste des entreprises en attente de validation (admin uniquement) -->
      <div v-if="props.isOpen && isAdmin" class="list-action">
        <button @click="openPendingModal" class="refresh-button" aria-label="Liste des entreprises en attente">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-list"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          <span v-if="pendingCompanies.length > 0" class="pending-badge">{{ pendingCompanies.length }}</span>
        </button>
      </div>

      <!-- Bouton pour afficher les tickets signalés (admin uniquement) -->
      <div v-if="props.isOpen && isAdmin" class="tickets-action">
        <button @click="openTicketsModal" class="refresh-button" :aria-label="t('tickets.title')">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-flag"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          <span v-if="openTicketsCount > 0" class="pending-badge">{{ openTicketsCount }}</span>
        </button>
      </div>

      <!-- Bouton pour rafraîchir la liste des entreprises -->
      <div v-if="props.isOpen" class="refresh-action">
        <button @click="fetchCompanies" class="refresh-button" aria-label="Rafraîchir">⟳</button>
      </div>

      <!-- Bouton d'ajout d'entreprise -->
      <div v-if="props.isOpen" class="add-company-action">
        <button @click="openModal" class="plus-button" aria-label="Ajouter">+</button>
      </div>
      
      <div v-if="props.isOpen" class="lang-switcher">
        <LangSwitcher />
      </div>
      
      <hr class="separator" />
      <h1>Find My Company</h1>
      <hr class="separator" />
      <h2 v-if="props.isOpen">{{ t('dropdownMenu.companyList') }}</h2>

      <!-- Barre de filtre pour les spécialités -->
      <div v-if="props.isOpen" class="filter-bar">
        <label for="speciality-select">{{ t('dropdownMenu.specialities') }} :</label>
        <select id="speciality-select" v-model="selectedSpeciality" @change="$emit('update-speciality', selectedSpeciality)" required>
            <option value="" >{{ t('dropdownMenu.defaultFilter') }}</option>
            <option value="Développement Logiciel, Tests et Qualité">{{ t('dropdownMenu.dltq') }}</option>
            <option value="IA & Big Data">{{ t('dropdownMenu.iabd') }}</option>
        </select>
      </div>
      <!-- Affiche la liste des entreprises si la sidebar est visible -->
      <ListCompanies v-if="props.isOpen" :companies="filteredCompanies" />
    </div>

    <!-- Fenêtre d'ajout d'entreprise -->
    <Modal :isOpen="isModalOpen" @close="closeModal">
      <AddCompanyForm @refresh="handleCompanyAdded" @close="closeModal" />
    </Modal>

    <!-- Fenêtre de connexion / inscription / déconnexion (admin et étudiant) -->
    <Modal :isOpen="isLoginModalOpen" @close="closeLoginModal">
      <LoginForm />
    </Modal>

    <!-- Fenêtre de validation des entreprises en attente (admin uniquement) -->
    <Modal :isOpen="isPendingModalOpen" @close="closePendingModal" style="--modal-width: 70%; --modal-height: 85%">
      <PendingCompanies @refresh="handleCompanyAdded" />
    </Modal>

    <!-- Fenêtre des tickets signalés (admin uniquement) -->
    <Modal :isOpen="isTicketsModalOpen" @close="closeTicketsModal" style="--modal-width: 70%; --modal-height: 85%">
      <TicketsList />
    </Modal>

    <!-- Bouton Ouverture/Fermeture sidebar -->
    <button
      class="toggle-button"
      @click="toggleSideBar"
      :class="{ closed: !props.isOpen }"
      :style="{ left: props.isOpen ? listeDeroulanteWidth+'px' : listeDeroulanteDefaultSize+'px' }"
    >
      <!-- Flèche pour savoir dans quel sens la sidebar va aller si on clique sur le bouton -->
      <span><span :class="['arrow', props.isOpen ? 'left' : 'right']"></span></span>
    </button>
  </div>
</template>

<style scoped>
h1{
  font-size: 2rem;
  margin-bottom: 1rem;
}

.separator {
  border: none;
  height: 4px;
  background-color: var(--red-esigelec);
  margin: 10px 0;
  width: 100%;
}

h2 {
  color: var(--red-esigelec);
  margin-bottom: 1rem;
}

.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  height: 100%;
  background-color: var(--background-white);
  padding: 20px;
  overflow-y: auto;
  overflow-x: hidden;
  transition: width 0.3s ease, padding 0.3s ease;
  box-sizing: border-box;
  z-index: 800;
}
.sidebar.closed {
  padding: 20px 0;
}
@media (max-width: 768px) {
  h1 {
    font-size: 1.5rem;
  }
}

.toggle-button {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  width: 35px;
  height: 60px;
  background-color: var(--red-esigelec);
  border: none;
  border-radius: 0 5px 5px 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: left 0.3s ease;
  z-index: 1001;
}
.toggle-button:hover {
  background-color: var(--red-btn-hover);
}

.arrow {
  border: solid var(--white);;
  border-width: 0 3px 3px 0;
  display: inline-block;
  padding: 5px;
}
.right {
  transform: rotate(-45deg);
}
.left {
  transform: rotate(135deg);
}

.filter-bar {
  margin-bottom: 1rem;
  color: var(--red-esigelec);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

select {
  padding: 5px 10px;
  border-radius: 5px;
  border: none;
  font-size: 1rem;
}

.add-company-action {
  position: absolute;
  top: -5px;
  right: 0px;
}
.list-action {
  position: absolute;
  top: 0px;
  left: 30px;
}
.tickets-action {
  position: absolute;
  top: 0px;
  left: 60px;
}
.connection-action {
  position: absolute;
  top: 0px;
  left: 0px;
}

.plus-button {
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  font-size: 30px;
  font-weight: bold;
  color: var(--red-esigelec);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.3s ease, transform 0.3s ease;
  padding: 0;
  border-radius: 4px;
  outline: none;
}
.plus-button:focus {
  outline: none;
  box-shadow: none;
}
.plus-button:focus:not(:focus-visible) {
  outline: none;
}
.plus-button:hover {
  color: var(--red-btn-hover);
  transform: scale(1.2);
}

.refresh-action {
  position: absolute;
  top: -2px;
  right: 30px;
}
.refresh-button {
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  font-size: 22px;
  font-weight: bold;
  color: var(--red-esigelec);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.3s ease, transform 0.3s ease;
  padding: 0;
  border-radius: 4px;
  outline: none;
}

.refresh-button:hover {
  color: var(--red-btn-hover);
  transform: scale(1.2);
}

.refresh-button.is-connected {
  color: #2e7d32;
}

.list-action .refresh-button,
.tickets-action .refresh-button {
  position: relative;
}

.pending-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  border-radius: 8px;
  background-color: var(--red-esigelec);
  color: var(--white);
  font-size: 10px;
  font-weight: bold;
  line-height: 16px;
  text-align: center;
}

.lang-switch {
  display: flex;
  gap: 5px;
  position: absolute;
  top: 1.5px;
  left: 50%;
  transform: translateX(-50%);
}



</style>
