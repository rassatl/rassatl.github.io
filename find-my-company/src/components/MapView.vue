<script setup>
/**
 * Composant MapView
 * Affiche la carte interactive Leaflet avec tous les marqueurs des entreprises
 * Gère la sélection par spécialité et le filtrage des entreprises visibles
 */

import { onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getAllCompanies } from '../services/companyService';

const mapContainer = ref(null);

// Props reçues du composant parent
const props = defineProps({
  isOpen: Boolean, // Indique si la sidebar est ouverte
  selectedSpeciality: String // Spécialité sélectionnée pour le filtrage
});

// Émets la liste des entreprises visibles dans le viewport
const emit = defineEmits(['update-visible-companies']);

// État local
const companies = ref([]); // Toutes les entreprises avec leurs marqueurs
let map = null; // Instance de la carte Leaflet

/**
 * Configuration personnalisée pour l'icône des marqueurs
 * Utilise une image externe (marqueur rouge) pour identifier les entreprises
 */
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

/**
 * Calcule et émet la liste des entreprises visibles dans le viewport actuel
 * Filtre les entreprises en fonction des limites géographiques de la carte
 */
function updateVisibleCompanies() {
  if (!map) return;

  const bounds = map.getBounds();

  // Filtrer les entreprises qui sont dans les limites actuelles de la carte
  const visibleCompanies = companies.value.filter(company => {
    return (
      company.x >= bounds.getSouth() &&
      company.x <= bounds.getNorth() &&
      company.y >= bounds.getWest() &&
      company.y <= bounds.getEast()
    );
  });

  // Émettre la mise à jour vers le composant parent
  emit('update-visible-companies', visibleCompanies);
}

/**
 * Charge toutes les entreprises depuis Firestore et ajoute des marqueurs sur la carte
 * Chaque marqueur est cliquable pour afficher une popup avec le nom
 */
const fetchCompaniesAndAddMarkers = async () => {
  try {
    const allCompanies = await getAllCompanies();

    allCompanies.forEach((company) => {
      // Vérifier que les données géographiques existent
      if (company.x && company.y && company.name) {
        // Créer le marqueur sur la carte
        const marker = L.marker([company.x, company.y], { icon: redIcon }).addTo(map);

        // Ajouter une popup affichant le nom de l'entreprise
        marker.bindPopup(`
          <div class="company-popup">
            <strong>${company.name}</strong><br>
            <small>${company.city}, ${company.country}</small>
          </div>
        `);

        // Stocker le marqueur dans les données de l'entreprise pour manipulation ultérieure
        company.marker = marker;
      }
    });

    companies.value = allCompanies;
    updateVisibleCompanies();

    console.log(`✅ ${allCompanies.length} entreprises chargées et affichées`);
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des entreprises:', error);
  }
};

/**
 * Initialisation du composant
 * Configure la carte Leaflet, charge les entreprises et met en place les écouteurs d'événements
 */
onMounted(async () => {
  // Initialiser la carte avec la France comme point de départ
  map = L.map(mapContainer.value, {
    center: [46.656066, 0.364419], // Centre géographique de la France
    zoom: 5,
    minZoom: 3, // Empêche le zoom trop loin
    maxBounds: [
      [-90, -180],
      [90, 180],
    ],
    worldCopyJump: false,
  });

  // Ajouter la couche de tuiles OpenStreetMap (gratuit et sans authentification)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Charger les entreprises et ajouter les marqueurs
  await fetchCompaniesAndAddMarkers();

  // Mettre à jour la liste visible quand la vue change
  map.on('moveend', () => updateVisibleCompanies());
  map.on('zoomend', () => updateVisibleCompanies());
  map.on('resize', () => updateVisibleCompanies());
});

/**
 * Watcher: Redimensionne la carte quand la sidebar s'ouvre/ferme
 * Utilise un délai pour attendre la transition CSS
 */
watch(
  () => props.isOpen,
  () => {
    setTimeout(() => {
      if (map) {
        map.invalidateSize(); // Force Leaflet à recalculer la taille
      }
    }, 400); // Délai correspondant à la transition CSS
  }
);

/**
 * Watcher: Filtre les marqueurs par spécialité
 * Affiche/masque les marqueurs en fonction de la spécialité sélectionnée
 */
watch(
  () => props.selectedSpeciality,
  (newSpeciality) => {
    if (!map) return;

    // Parcourir toutes les entreprises et afficher/masquer les marqueurs
    companies.value.forEach(company => {
      if (company.marker) {
        // Si aucune spécialité sélectionnée ou spécialité correspondante
        const shouldShow = !newSpeciality || newSpeciality === 'Toutes' || company.speciality === newSpeciality;

        if (shouldShow) {
          // Ajouter le marqueur s'il n'est pas déjà sur la carte
          if (!map.hasLayer(company.marker)) {
            company.marker.addTo(map);
          }
        } else {
          // Retirer le marqueur de la carte
          if (map.hasLayer(company.marker)) {
            company.marker.remove();
          }
        }
      }
    });

    // Mettre à jour la liste visible après le filtrage
    updateVisibleCompanies();
  },
  { immediate: true } // Exécuter immédiatement avec la valeur initiale
);
</script>

<template>
  <!-- Conteneur pour la carte Leaflet -->
  <div
    id="map"
    ref="mapContainer"
    class="map-container"
    :class="{ 'sidebar-open': props.isOpen, 'sidebar-closed': !props.isOpen }"
  ></div>
</template>

<style scoped>
.map-container {
  position: absolute;
  top: 0;
  left: 0;
  height: 100vh;
  width: 100%;
  transition: all 0.3s ease;
  z-index: 0;
  overflow: hidden;
}

/* Classe Leaflet pour les popups personnalisées */
:deep(.company-popup) {
  white-space: nowrap;
}
</style>
