<script setup>
import { onMounted, ref, computed, watch, inject } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { iconForSpeciality } from '../mapIcons';
import MapLayerSwitcher from './MapLayerSwitcher.vue';

const t = inject('t')
const mapContainer = ref(null);
const props = defineProps({selectedSpeciality: String});
const emit = defineEmits(['update-visible-companies'])

const companies = ref([])
const activeLayerKey = ref('standard');
let layerInstances = {};

// Vignettes miniatures : une même tuile (France, zoom 5) chez chaque
// fournisseur, pour donner un vrai aperçu visuel de chaque style de carte.
const layerOptions = computed(() => [
  { key: 'standard', label: t('mapLayers.standard'), thumbnail: 'https://a.tile.openstreetmap.org/5/16/11.png' },
  { key: 'satellite', label: t('mapLayers.satellite'), thumbnail: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/5/11/16' },
  { key: 'dark', label: t('mapLayers.dark'), thumbnail: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/5/11/16' },
  { key: 'terrain', label: t('mapLayers.terrain'), thumbnail: 'https://a.tile.opentopomap.org/5/16/11.png' },
]);

let map = null;

// Fonction pour mettre à jour les entreprises visibles sur la carte
function updateVisibleCompanies() {
  const bounds = map.getBounds()
  emit('update-visible-companies', companies.value.filter(company => {
    return (
      company.x >= bounds.getSouth() &&
      company.x <= bounds.getNorth() &&
      company.y >= bounds.getWest() &&
      company.y <= bounds.getEast()
    )
  }))
}


onMounted(async () => {
  // Initialiser la carte
  map = L.map(mapContainer.value, {
    center: [46.656066, 0.364419],
    zoom: 5,
    minZoom: 3,
    maxBounds: [
      [-90, -180],
      [90, 180],
    ],
    worldCopyJump: false,
  });

  // Plusieurs fonds de carte au choix (standard, satellite, sombre, relief)
  const standardLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  });

  const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: 19,
  });

  const darkLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community',
    maxZoom: 16,
  });

  const terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors, SRTM | &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    maxZoom: 17,
  });

  layerInstances = { standard: standardLayer, satellite: satelliteLayer, dark: darkLayer, terrain: terrainLayer };
  standardLayer.addTo(map);

  // Récupérer les entreprises depuis Firestore et ajouter des marqueurs
  await fetchCompaniesAndAddMarkers();

  map.on('moveend', () => {
    updateVisibleCompanies()
  })
  map.on('zoomend', () => {
    updateVisibleCompanies()
  })
  map.on('resize', () => {
    updateVisibleCompanies()
  })

  window.addEventListener('resize', () => {
    map.invalidateSize();
  });
});

// Fonction pour récupérer les entreprises et ajouter des marqueurs
const fetchCompaniesAndAddMarkers = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'companies'));
    const companyList = [];
    querySnapshot.forEach((doc) => {
      const company = doc.data();
      const { x, y, name, speciality } = company;
      if (x && y && name) {
        const marker = L.marker([x, y], {icon: iconForSpeciality(speciality)}).addTo(map);
        const popupContent = document.createElement('span');
        popupContent.textContent = name;
        marker.bindPopup(popupContent);
        companyList.push({ ...company, marker });
      }
    });
    companies.value = companyList
  } catch (error) {
    console.error('Erreur lors de la récupération des entreprises:', error);
  }
};

// Recharge la liste des entreprises depuis Firestore (ex: après l'ajout
// d'une entreprise) en remplaçant les marqueurs existants sur la carte.
const refreshCompanies = async () => {
  companies.value.forEach(company => {
    if (company.marker) {
      company.marker.remove();
    }
  });
  await fetchCompaniesAndAddMarkers();
  applySpecialityFilter(props.selectedSpeciality);
  updateVisibleCompanies();
};

defineExpose({ refreshCompanies });

// Change le fond de carte affiché.
function selectLayer(key) {
  if (key === activeLayerKey.value || !layerInstances[key]) return;
  map.removeLayer(layerInstances[activeLayerKey.value]);
  map.addLayer(layerInstances[key]);
  activeLayerKey.value = key;
}

// Affiche/masque les marqueurs selon la spécialité sélectionnée
function applySpecialityFilter(category) {
  if (!map) return;
  companies.value.forEach(company => {
    if (company.marker) {
      if (!category || company.speciality === category) {
        if (!map.hasLayer(company.marker)) {
          company.marker.addTo(map);
        }
      } else {
        if (map.hasLayer(company.marker)) {
          company.marker.remove();
        }
      }
    }
  });
}

watch(
  () => props.selectedSpeciality,
  (newCategory) => {
    if (!map) return;
    applySpecialityFilter(newCategory);
    updateVisibleCompanies();
  },
  { immediate: true }
);

</script>

<template>
  <!-- Conteneur pour la carte Leaflet -->
  <div id="map" ref="mapContainer" class="map-container"></div>
  <MapLayerSwitcher :layers="layerOptions" :active="activeLayerKey" @select="selectLayer" />
</template>

<style scoped>
.map-container {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  transition: all 0.3s ease;
  z-index: 0;
  overflow: hidden;
}
</style>
