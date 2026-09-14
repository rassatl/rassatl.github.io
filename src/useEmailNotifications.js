import emailjs from '@emailjs/browser'

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

// Construit le lien envoyé par email, permettant au contact de masquer ses
// informations personnelles sans avoir besoin de se connecter : la
// possession du jeton (généré côté serveur Firestore, jamais deviné) suffit.
const buildHideUrl = (companyId, contactId, hideToken) => {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}?hideContact=${companyId}:${contactId}:${hideToken}`
}

export function useEmailNotifications() {
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
    }
  }

  // Prévient chaque contact publié qu'il apparaît sur le site, avec un lien
  // pour masquer ses informations personnelles s'il le souhaite.
  const notifyContacts = async (contacts, companyName, companyId) => {
    await Promise.all(contacts.map(contact => notifyContact(contact, companyName, companyId)))
  }

  return { notifyContacts }
}
