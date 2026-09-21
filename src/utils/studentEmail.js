// Domaine des adresses email étudiantes. À garder synchronisé avec
// isStudent() dans firestore.rules : c'est la règle Firestore qui fait foi,
// ce contrôle côté navigateur n'évite qu'un aller-retour inutile.
export const STUDENT_EMAIL_DOMAIN = 'groupe-esigelec.org'

const studentEmailPattern = new RegExp(`^[^\\s@]+@${STUDENT_EMAIL_DOMAIN.replace(/\./g, '\\.')}$`, 'i')

export const isStudentEmail = (email) => studentEmailPattern.test((email ?? '').trim())
