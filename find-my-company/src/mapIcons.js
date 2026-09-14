import L from 'leaflet';

const iconOptions = {
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
};

export const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  ...iconOptions,
});

export const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  ...iconOptions,
});

// Rouge pour "Développement Logiciel, Tests et Qualité", bleu pour "IA & Big Data".
export function iconForSpeciality(speciality) {
  return speciality === 'IA & Big Data' ? blueIcon : redIcon;
}
