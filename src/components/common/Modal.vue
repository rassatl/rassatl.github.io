<script setup>

// Un Teleport ne propage pas automatiquement les attributs du parent
// (comme un style avec --modal-width/--modal-height) : on les applique
// nous-même sur l'élément téléporté via $attrs.
defineOptions({ inheritAttrs: false });

defineProps({
  isOpen: Boolean,
});

const emit = defineEmits(['close']);

// Une sélection de texte commencée dans le contenu peut se terminer (mouseup)
// sur l'overlay si l'utilisateur glisse la souris en dehors : `click.self`
// se déclencherait alors à tort. On ne ferme que si le clic a aussi
// commencé sur l'overlay lui-même.
let mousedownOnOverlay = false;
const onOverlayMousedown = (event) => {
  mousedownOnOverlay = event.target === event.currentTarget;
};
const onOverlayClick = (event) => {
  if (mousedownOnOverlay && event.target === event.currentTarget) {
    emit('close');
  }
};
</script>

<template>
  <!-- Utilisation de Teleport pour rendre le modal dans le body -->
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" v-bind="$attrs" @mousedown="onOverlayMousedown" @click="onOverlayClick">
      <div class="modal-content">
        <button class="modal-close" @click="emit('close')">×</button>
        <slot></slot>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}
.modal-content {
  background: white;
  padding: 20px;
  width: var(--modal-width, auto);
  height: var(--modal-height, auto);
  border-radius: 8px;
  position: relative;
  box-sizing: border-box;
}

/* Les tailles en % (--modal-width/--modal-height) sont pensées pour desktop
   et laissent beaucoup de vide sur mobile : on les remplace par une taille
   qui s'adapte au contenu et à l'écran, quel que soit le modal affiché. */
@media (max-width: 600px) {
  .modal-content {
    width: 92vw;
    max-width: 92vw;
    height: auto;
    max-height: 88vh;
    overflow-y: auto;
  }
}
.modal-close {
  color: var(--black);
  position: absolute;
  top: 0px;
  right: 0px;
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  /* Les panes internes de Leaflet (jusqu'à z-index 700) ne créent pas leur
     propre contexte d'empilement : sans z-index explicite ici, une carte
     affichée dans le contenu de la modale peut passer devant ce bouton. */
  z-index: 10;
}
</style>
