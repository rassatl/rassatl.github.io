import { db } from '../services/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

// Journalise une erreur rencontrée par un visiteur dans Firestore (collection
// errorLogs, lisible uniquement par un admin — voir firestore.rules) : ça
// permet de diagnostiquer un problème en prod sans dépendre de la console du
// navigateur de la personne qui l'a rencontré.
export function useErrorLogs() {
  const logError = async (error, context) => {
    try {
      await addDoc(collection(db, 'errorLogs'), {
        message: String(error?.message ?? error ?? 'Erreur inconnue').slice(0, 500),
        ...(error?.code ? { code: String(error.code).slice(0, 100) } : {}),
        stack: String(error?.stack ?? '').slice(0, 3000),
        context: String(context ?? '').slice(0, 200),
        createdAt: serverTimestamp(),
        pageUrl: window.location.href.slice(0, 500),
        userAgent: navigator.userAgent.slice(0, 300),
      })
    } catch {
      // Ne doit jamais faire échouer le code appelant : si Firestore refuse
      // aussi ce write, on abandonne silencieusement.
    }
  }

  return { logError }
}
