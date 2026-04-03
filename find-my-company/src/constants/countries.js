// Codes ISO 3166-1 alpha-2 (liste large pour générer les noms localisés).
const COUNTRY_CODES = [
  'AF', 'AL', 'DZ', 'AD', 'AO', 'AG', 'AR', 'AM', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB',
  'BY', 'BE', 'BZ', 'BJ', 'BT', 'BO', 'BA', 'BW', 'BR', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH',
  'CM', 'CA', 'CF', 'TD', 'CL', 'CN', 'CO', 'KM', 'CG', 'CD', 'CR', 'CI', 'HR', 'CU', 'CY',
  'CZ', 'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FJ', 'FI',
  'FR', 'GA', 'GM', 'GE', 'DE', 'GH', 'GR', 'GD', 'GT', 'GN', 'GW', 'GY', 'HT', 'HN', 'HU',
  'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IL', 'IT', 'JM', 'JP', 'JO', 'KZ', 'KE', 'KI', 'KP',
  'KR', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MG', 'MW', 'MY',
  'MV', 'ML', 'MT', 'MH', 'MR', 'MU', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MA', 'MZ', 'MM',
  'NA', 'NR', 'NP', 'NL', 'NZ', 'NI', 'NE', 'NG', 'MK', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA',
  'PG', 'PY', 'PE', 'PH', 'PL', 'PT', 'QA', 'RO', 'RU', 'RW', 'KN', 'LC', 'VC', 'WS', 'SM',
  'ST', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SK', 'SI', 'SB', 'SO', 'ZA', 'SS', 'ES', 'LK',
  'SD', 'SR', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TO', 'TT', 'TN', 'TR',
  'TM', 'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UY', 'UZ', 'VU', 'VA', 'VE', 'VN', 'YE', 'ZM',
  'ZW'
];

const normalize = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

/**
 * Retourne la liste des pays traduits selon la langue sélectionnée.
 * @param {'fr'|'en'} language
 * @returns {string[]}
 */
export const getWorldCountries = (language = 'fr') => {
  const locale = language === 'en' ? 'en' : 'fr';

  if (typeof Intl === 'undefined' || typeof Intl.DisplayNames === 'undefined') {
    return [...COUNTRY_CODES].sort();
  }

  const displayNames = new Intl.DisplayNames([locale], { type: 'region' });
  return COUNTRY_CODES
    .map((code) => displayNames.of(code))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, locale));
};

/**
 * Retourne le code ISO alpha-2 d'un pays à partir de son nom (FR/EN).
 * @param {string} countryName
 * @returns {string} ex: 'ma' pour Maroc/Morocco, sinon ''
 */
export const getCountryCodeByName = (countryName) => {
  const target = normalize(countryName);
  if (!target) {
    return '';
  }

  if (typeof Intl === 'undefined' || typeof Intl.DisplayNames === 'undefined') {
    return '';
  }

  const displayFr = new Intl.DisplayNames(['fr'], { type: 'region' });
  const displayEn = new Intl.DisplayNames(['en'], { type: 'region' });

  const match = COUNTRY_CODES.find((code) => {
    const fr = normalize(displayFr.of(code));
    const en = normalize(displayEn.of(code));
    return target === fr || target === en;
  });

  return match ? match.toLowerCase() : '';
};
