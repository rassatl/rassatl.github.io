import emailjs from '@emailjs/browser'
import { useErrorLogs } from './useErrorLogs.js'

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
const VERIFY_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_VERIFY_TEMPLATE_ID

// Construit le lien envoyé par email, permettant au contact de masquer ses
// informations personnelles sans avoir besoin de se connecter : la
// possession du jeton (généré côté serveur Firestore, jamais deviné) suffit.
const buildHideUrl = (companyId, contactId, hideToken) => {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}?hideContact=${companyId}:${contactId}:${hideToken}`
}

// Même principe que buildHideUrl, pour confirmer l'adresse email d'un compte
// étudiant à l'inscription (voir useAuth.js et VerifyAccountInfo.vue) :
// remplace le sendEmailVerification natif de Firebase, qui arrivait souvent
// en indésirables/quarantaine et dont on ne maîtrise pas la délivrabilité.
const buildVerifyUrl = (uid, token) => {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}?verifyAccount=${uid}:${token}`
}

export function useEmailNotifications() {
  const { logError } = useErrorLogs()

  const notifyContact = async (contact, companyName, companyId) => {
    if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
      console.warn("EmailJS n'est pas configuré (VITE_EMAILJS_*) : email de notification non envoyé.")
      return
    }
    try {
      await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
        to_email: contact.email,
        to_name: `${contact.firstName} ${contact.lastName}`,
        company_name: companyName,
        contact_role: contact.role,
        hide_url: buildHideUrl(companyId, contact.id, contact.hideToken),
      }, { publicKey: PUBLIC_KEY })
    } catch (e) {
      console.error(`Erreur lors de l'envoi de l'email à ${contact.email} :`, e)
      logError(e, 'emailNotifications:notifyContact')
    }
  }

  // Prévient chaque contact publié qu'il apparaît sur le site, avec un lien
  // pour masquer ses informations personnelles s'il le souhaite.
  const notifyContacts = async (contacts, companyName, companyId) => {
    await Promise.all(contacts.map(contact => notifyContact(contact, companyName, companyId)))
  }

  // Envoie le lien de vérification à l'inscription (ou son renvoi). Utilise
  // un template EmailJS séparé (VITE_EMAILJS_VERIFY_TEMPLATE_ID) : contenu
  // différent, et ne doit pas être bloqué par une éventuelle absence du
  // template de notification des contacts.
  const sendVerificationEmail = async (email, uid, token) => {
    if (!SERVICE_ID || !VERIFY_TEMPLATE_ID || !PUBLIC_KEY) {
      console.warn("EmailJS n'est pas configuré (VITE_EMAILJS_VERIFY_*) : email de vérification non envoyé.")
      return
    }
    try {
      await emailjs.send(SERVICE_ID, VERIFY_TEMPLATE_ID, {
        to_email: email,
        verify_url: buildVerifyUrl(uid, token),
      }, { publicKey: PUBLIC_KEY })
    } catch (e) {
      console.error(`Erreur lors de l'envoi de l'email de vérification à ${email} :`, e)
      logError(e, 'emailNotifications:sendVerificationEmail')
    }
  }

  return { notifyContacts, sendVerificationEmail }
}
