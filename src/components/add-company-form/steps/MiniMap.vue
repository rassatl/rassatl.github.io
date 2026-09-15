<script setup>
import { ref, watch, onMounted, inject } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-control-geocoder';
import { iconForSpeciality } from '../../../utils/mapIcons';

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
let map = null;
let marker = null;
let addressDebounceTimeout = null;
const isLoading = ref(false);

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

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

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
    try {
      const params = new URLSearchParams({
        street: newAddress,
        city: newCity,
        postalcode: newPc,
        country: newCountry,
        format: 'json'
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FindMyCompany/1.0 (lou.rassat2003@gmail.com)'
        }
      });

      const results = await response.json();

      if (results && results.length > 0) {
        const { lat, lon } = results[0];
        placeMarker(L.latLng(lat, lon), { recenter: true });
      } else {
        console.warn("Aucun résultat pour cette adresse.");
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
    <div class="mini-map" ref="mapContainer"></div>
    <p class="map-hint">
      {{ isPinPlaced ? t('addCompanyForm.mapAdjustHint') : t('addCompanyForm.mapPlaceHint') }}
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

.mini-map {
  width: 100%;
  flex: 1 1 auto;
  min-height: 300px;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  cursor: crosshair;
  /* Les panes internes de Leaflet montent jusqu'à z-index:700 ; sans ceci,
     ces valeurs remontent hors de la carte et passent devant le bouton de
     fermeture de la modale (z-index:10). isolation:isolate les enferme ici. */
  isolation: isolate;
}

.map-hint {
  margin: 0;
  font-size: 0.85em;
  color: var(--gray-dark);
  text-align: center;
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
