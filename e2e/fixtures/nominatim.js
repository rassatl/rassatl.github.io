// Le formulaire d'ajout d'entreprise appelle l'API publique Nominatim
// (nominatim.openstreetmap.org) : une fois pour géocoder l'adresse saisie
// (MiniMap.vue), une fois pour vérifier au moment de la soumission que les
// coordonnées placées sur la carte correspondent bien au pays sélectionné
// (AddCompanyForm.vue). On intercepte les deux pour rendre les tests
// déterministes, rapides, et ne pas dépendre d'un service tiers ni risquer
// de dépasser sa politique d'usage pendant les tests.
export async function mockNominatim(page, { country = 'France' } = {}) {
  // Renvoie toujours "aucun résultat" : évite que le géocodage automatique
  // (déclenché par la saisie des champs adresse/ville/pays) ne déplace le
  // repère après qu'on l'a placé nous-même en cliquant sur la carte.
  await page.route('https://nominatim.openstreetmap.org/search**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )

  // Utilisé par la vérification finale à la soumission : doit correspondre
  // au pays sélectionné dans le formulaire pour que la soumission passe.
  await page.route('https://nominatim.openstreetmap.org/reverse**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ address: { country } }),
    })
  )
}
