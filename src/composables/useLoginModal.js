import { reactive, computed } from 'vue'

// État partagé de la fenêtre de connexion / inscription, ouvrable depuis
// n'importe où (icône de la sidebar, mais aussi les endroits qui exigent un
// compte étudiant vérifié : étape de vérification du formulaire d'ajout,
// contacts d'une fiche d'entreprise) sans avoir à faire remonter un
// événement à travers plusieurs composants parents.
const state = reactive({ isOpen: false })

export function useLoginModal() {
  return {
    isOpen: computed(() => state.isOpen),
    open: () => { state.isOpen = true },
    close: () => { state.isOpen = false }
  }
}
