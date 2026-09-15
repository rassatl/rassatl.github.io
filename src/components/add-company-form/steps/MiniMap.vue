<script setup>
import { ref, watch, onMounted, inject, computed } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-control-geocoder';
import { iconForSpeciality } from '../../../utils/mapIcons';
import MapLayerSwitcher from '../../map/MapLayerSwitcher.vue';

const t = inject('t')
const props = defineProps({
  speciality: { type: String, default: '' },
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  pc: { type: String, default: '' },
  country: { type: String, default: '' },
  pendingCompany: { type: Object, default: null },
});

const x = defineModel('x', { default: '' })
const y = defineModel('y', { default: '' })

const mapContainer = ref(null);
const isPinPlaced = ref(false);
const streetNotFound = ref(false);
let map = null;
let marker = null;
let addressDebounceTimeout = null;
const isLoading = ref(false);

const geocode = async (params) => {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${new URLSearchParams({ ...params, format: 'json' })}`, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'FindMyCompany/1.0 (lou.rassat2003@gmail.com)'
    }
  });
  return response.json();
};

const activeLayerKey = ref('standard');
let layerInstances = {};
const layerOptions = computed(() => [
  { key: 'standard', label: t('mapLayers.standard'), thumbnail: 'https://a.tile.openstreetmap.org/5/16/11.png' },
  { key: 'satellite', label: t('mapLayers.satellite'), thumbnail: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/5/11/16' },
  { key: 'dark', label: t('mapLayers.dark'), thumbnail: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/5/11/16' },
  { key: 'terrain', label: t('mapLayers.terrain'), thumbnail: 'https://a.tile.opentopomap.org/5/16/11.png' },
]);

// Change le fond de carte affiché.
function selectLayer(key) {
  if (key === activeLayerKey.value || !layerInstances[key]) return;
  map.removeLayer(layerInstances[activeLayerKey.value]);
  map.addLayer(layerInstances[key]);
  activeLayerKey.value = key;
}

// Pose ou déplace le repère et synchronise les coordonnées du formulaire.
// Utilisé aussi bien par le géocodage automatique que par un ajustement
// manuel (glisser ou clic sur la carte).
const placeMarker = (latlng, { recenter = false } = {}) => {
  if (!marker) {
    marker = L.marker(latlng, { icon: iconForSpeciality(props.speciality), draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      x.value = pos.lat;
      y.value = pos.lng;
    });
  } else {
    marker.setLatLng(latlng);
  }

  isPinPlaced.value = true;
  streetNotFound.value = false;
  x.value = latlng.lat;
  y.value = latlng.lng;

  if (recenter) {
    map.setView(latlng, 15);
  }
};

// Garde la couleur du repère cohérente avec la spécialité choisie.
watch(() => props.speciality, (newSpeciality) => {
  if (marker) {
    marker.setIcon(iconForSpeciality(newSpeciality));
  }
});

onMounted(() => {
  map = L.map(mapContainer.value, {
    center: [46.656066, 0.364419],
    zoom: 5,
    minZoom: 3,
    maxBounds: [[-90, -180], [90, 180]],
    worldCopyJump: false,
  });

  // Plusieurs fonds de carte au choix (standard, satellite, sombre, relief),
  // comme sur la carte principale (voir MapView.vue).
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

  // Permet à l'utilisateur d'ajuster ou de placer le point manuellement
  // en cliquant directement sur la carte d'aperçu.
  map.on('click', (e) => placeMarker(e.latlng));

  // En mode révision, on affiche directement la position déjà soumise
  // plutôt que de relancer une recherche d'adresse.
  if (props.pendingCompany) {
    placeMarker(L.latLng(props.pendingCompany.x, props.pendingCompany.y), { recenter: true });
  }
});

// Une fois l'adresse complète connue (rue + ville + code postal + pays),
// on géocode précisément pour placer le point sur la carte d'aperçu.
watch(() => [props.address, props.city, props.pc, props.country], ([newAddress, newCity, newPc, newCountry]) => {
  clearTimeout(addressDebounceTimeout);
  addressDebounceTimeout = setTimeout(async () => {
    if (![newAddress, newCity, newPc, newCountry].every(field => field.trim() !== '')) {
      return;
    }

    isLoading.value = true;
    streetNotFound.value = false;
    try {
      const results = await geocode({ street: newAddress, city: newCity, postalcode: newPc, country: newCountry });

      if (results && results.length > 0) {
        const { lat, lon } = results[0];
        placeMarker(L.latLng(lat, lon), { recenter: true });
        return;
      }

      // La rue exacte n'est pas toujours indexée dans OpenStreetMap (rue peu
      // cartographiée, orthographe différente...) : on retente sans elle pour
      // au moins centrer la carte sur la bonne ville, l'utilisateur plaçant
      // ensuite le point à la main plutôt que de rester sur la carte de France.
      console.warn("Aucun résultat pour cette adresse, nouvelle tentative sans la rue.");
      const cityResults = await geocode({ city: newCity, postalcode: newPc, country: newCountry });
      if (cityResults && cityResults.length > 0) {
        const { lat, lon } = cityResults[0];
        map.setView(L.latLng(lat, lon), 13);
        streetNotFound.value = true;
      } else {
        console.warn("Aucun résultat non plus pour la ville seule.");
      }
    } catch (error) {
      console.error("Erreur lors de l'appel à Nominatim:", error);
    } finally {
      isLoading.value = false;
    }
  }, 500);
});

// La mini-carte est cachée (v-show) sur les étapes 2 à 4 : Leaflet calcule
// mal ses tuiles pendant qu'un conteneur est en display:none, il faut donc
// recalculer sa taille à chaque retour sur l'étape 1.
const invalidateSize = () => {
  if (map) setTimeout(() => map.invalidateSize(), 0);
};

defineExpose({ invalidateSize });
</script>

<template>
  <div class="mini-map-wrapper">
    <div class="mini-map-container">
      <div class="mini-map" ref="mapContainer"></div>
      <MapLayerSwitcher :layers="layerOptions" :active="activeLayerKey" @select="selectLayer" />
    </div>
    <p class="map-hint" :class="{ 'map-hint-warning': streetNotFound && !isPinPlaced }">
      {{ streetNotFound && !isPinPlaced
        ? t('addCompanyForm.mapStreetNotFoundHint')
        : (isPinPlaced ? t('addCompanyForm.mapAdjustHint') : t('addCompanyForm.mapPlaceHint')) }}
    </p>
  </div>
</template>

<style scoped>
.mini-map-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 600px;
  flex-shrink: 0;
}

.mini-map-container {
  position: relative;
  flex: 1 1 auto;
  min-height: 300px;
  /* Les panes internes de Leaflet montent jusqu'à z-index:700 ; sans ceci,
     ces valeurs remontent hors de la carte et passent devant le bouton de
     fermeture de la modale (z-index:10). isolation:isolate les enferme ici. */
  isolation: isolate;
}

.mini-map {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  cursor: crosshair;
}

/* MapLayerSwitcher est en position:fixed par défaut (pensé pour la carte
   plein écran) : ici on le rattache au conteneur de la mini-carte pour
   éviter qu'il se superpose au sélecteur de la carte principale visible
   derrière la modale. */
.mini-map-container :deep(.layer-switcher) {
  position: absolute;
  bottom: 8px;
  right: 8px;
}

.map-hint {
  margin: 0;
  font-size: 0.85em;
  color: var(--gray-dark);
  text-align: center;
}

.map-hint-warning {
  color: var(--red-esigelec);
  font-weight: 600;
}

@media (max-width: 768px) {
  .mini-map-wrapper {
    width: 100%;
  }
  .mini-map {
    width: 100%;
    height: 300px;
  }
}
</style>
