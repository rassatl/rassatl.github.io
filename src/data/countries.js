import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';
import fr from 'i18n-iso-countries/langs/fr.json';

countries.registerLocale(en);
countries.registerLocale(fr);

export function getCountryList(lang = 'fr') {
  const names = countries.getNames(lang, { select: 'official' });
  // getNames() renvoie les pays triés par code ISO, pas par nom : on retrie
  // par ordre alphabétique du nom affiché (celui vu par l'utilisateur).
  return Object.fromEntries(
    Object.entries(names).sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB, lang))
  );
}
