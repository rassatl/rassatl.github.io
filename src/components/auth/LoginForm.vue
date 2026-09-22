<script setup>
import { ref, inject } from 'vue'
import { useAuth } from '../../composables/useAuth.js'
import { useLoginModal } from '../../composables/useLoginModal.js'
import { useErrorLogs } from '../../composables/useErrorLogs.js'
import { isStudentEmail } from '../../utils/studentEmail.js'

const t = inject('t')
const {
  user, isAdmin, checkingAdmin, studentEmail,
  login, logout, signup, resendVerificationEmail, refreshUser
} = useAuth()
const { close: closeLoginModal } = useLoginModal()
const { logError } = useErrorLogs()

// 'login' | 'signup' | 'signup-done'. Piloté explicitement plutôt que déduit
// de l'état de connexion : pendant l'inscription, createUserWithEmailAndPassword
// connecte brièvement le nouveau compte (non vérifié) avant qu'on le
// déconnecte nous-même (voir useAuth.signup) — sans ce mode, le panneau
// "email non vérifié" flasherait une fraction de seconde à la place du
// formulaire d'inscription.
const mode = ref('login')

const loginEmail = ref('')
const loginPassword = ref('')
const loginError = ref('')
const isLoggingIn = ref(false)

const signupEmail = ref('')
const signupPassword = ref('')
const signupConfirmPassword = ref('')
const signupError = ref('')
const isSigningUp = ref(false)

const resendStatus = ref('idle') // 'idle' | 'sending' | 'sent' | 'error'
const isRefreshing = ref(false)

const signupErrorKeys = {
  'auth/email-already-in-use': 'login.emailAlreadyInUse',
  'auth/weak-password': 'login.weakPassword',
  'auth/invalid-email': 'addCompanyForm.studentEmailInvalid'
}

const submitLogin = async () => {
  loginError.value = ''
  isLoggingIn.value = true
  try {
    await login(loginEmail.value, loginPassword.value)
    loginEmail.value = ''
    loginPassword.value = ''
  } catch (e) {
    // Un identifiant invalide est une erreur d'usage courante (mauvais mot
    // de passe, compte pas encore vérifié utilisé avec un mauvais email...),
    // pas un problème technique : pas la peine de la journaliser dans errorLogs.
    loginError.value = t('login.error')
  } finally {
    isLoggingIn.value = false
  }
}

const showSignup = () => {
  signupEmail.value = ''
  signupPassword.value = ''
  signupConfirmPassword.value = ''
  signupError.value = ''
  mode.value = 'signup'
}

const showLogin = () => {
  loginError.value = ''
  mode.value = 'login'
}

const submitSignup = async () => {
  signupError.value = ''
  if (!isStudentEmail(signupEmail.value)) {
    signupError.value = t('addCompanyForm.studentEmailInvalid')
    return
  }
  if (signupPassword.value !== signupConfirmPassword.value) {
    signupError.value = t('login.passwordMismatch')
    return
  }
  isSigningUp.value = true
  try {
    await signup(signupEmail.value, signupPassword.value)
    mode.value = 'signup-done'
  } catch (e) {
    console.error("Erreur lors de la création du compte : ", e)
    logError(e, 'loginForm:signup')
    signupError.value = t(signupErrorKeys[e.code] ?? 'login.signupError')
  } finally {
    isSigningUp.value = false
  }
}

const handleResend = async () => {
  resendStatus.value = 'sending'
  try {
    await resendVerificationEmail()
    resendStatus.value = 'sent'
  } catch (e) {
    console.error("Erreur lors du renvoi de l'email de vérification : ", e)
    logError(e, 'loginForm:resendVerification')
    resendStatus.value = 'error'
  }
}

const handleRefresh = async () => {
  isRefreshing.value = true
  try {
    await refreshUser()
  } catch (e) {
    console.error("Erreur lors de l'actualisation du compte : ", e)
    logError(e, 'loginForm:refreshUser')
  } finally {
    isRefreshing.value = false
  }
}

const handleLogout = async () => {
  await logout()
  mode.value = 'login'
  resendStatus.value = 'idle'
  // Rien de plus à montrer une fois déconnecté : referme le panneau, comme
  // pour toute autre action terminée (cohérent avec les autres modales).
  closeLoginModal()
}
</script>

<template>
  <div class="login-container">
    <!-- Administrateur connecté -->
    <template v-if="isAdmin">
      <h2>{{ t('login.loggedInAs') }}</h2>
      <p class="login-email-display">{{ user?.email }}</p>
      <button type="button" class="submit-button" @click="handleLogout">{{ t('login.logout') }}</button>
    </template>

    <!-- Étudiant connecté et vérifié -->
    <template v-else-if="studentEmail">
      <h2>{{ t('login.loggedInAsStudent') }}</h2>
      <p class="login-email-display">{{ studentEmail }}</p>
      <button type="button" class="submit-button" @click="handleLogout">{{ t('login.logout') }}</button>
    </template>

    <!-- Bref instant, le temps de savoir si le compte qui vient de se
         connecter est admin (lecture Firestore) : sans cette étape, un admin
         verrait le panneau "email non vérifié" clignoter avant sa vraie vue. -->
    <template v-else-if="user && checkingAdmin">
      <p class="checking">{{ t('login.checking') }}</p>
    </template>

    <!-- Connecté, mais ni admin ni étudiant vérifié : email pas encore confirmé -->
    <template v-else-if="user && !isSigningUp">
      <h2>{{ t('login.notVerifiedTitle') }}</h2>
      <p class="login-email-display">{{ user.email }}</p>
      <p>{{ t('login.notVerifiedText') }}</p>
      <p class="spam-warning" role="note">⚠ {{ t('login.spamWarning') }}</p>
      <button type="button" class="submit-button" :disabled="isRefreshing" @click="handleRefresh">
        {{ t('login.iVerified') }}
      </button>
      <button type="button" class="secondary-button" :disabled="resendStatus === 'sending'" @click="handleResend">
        {{ t('login.resendVerification') }}
      </button>
      <p v-if="resendStatus === 'sent'" class="resend-status">{{ t('login.resendVerificationSent') }}</p>
      <p v-else-if="resendStatus === 'error'" class="resend-status error">{{ t('login.resendVerificationError') }}</p>
      <button type="button" class="link-button" @click="handleLogout">{{ t('login.logout') }}</button>
    </template>

    <!-- Formulaire d'inscription (étudiants uniquement) -->
    <template v-else-if="mode === 'signup'">
      <h2>{{ t('login.signupTitle') }}</h2>
      <p class="signup-hint">{{ t('login.signupHint') }}</p>
      <form @submit.prevent="submitSignup">
        <div class="form-group">
          <label for="signup-email">{{ t('addCompanyForm.studentEmailLabel') }}</label>
          <input
            id="signup-email" type="email" v-model="signupEmail"
            autocomplete="username" :placeholder="t('addCompanyForm.studentEmailPlaceholder')" required
          />
        </div>
        <div class="form-group">
          <label for="signup-password">{{ t('login.password') }}</label>
          <input id="signup-password" type="password" v-model="signupPassword" autocomplete="new-password" required />
        </div>
        <div class="form-group">
          <label for="signup-confirm-password">{{ t('login.confirmPassword') }}</label>
          <input id="signup-confirm-password" type="password" v-model="signupConfirmPassword" autocomplete="new-password" required />
        </div>
        <p v-if="signupError" class="login-error">{{ signupError }}</p>
        <button type="submit" class="submit-button" :disabled="isSigningUp">{{ t('login.signupSubmit') }}</button>
      </form>
      <button type="button" class="link-button" @click="showLogin">{{ t('login.alreadyHaveAccount') }}</button>
    </template>

    <!-- Confirmation après inscription : le compte existe mais n'est pas
         encore utilisable, il faut vérifier l'email puis se reconnecter. -->
    <template v-else-if="mode === 'signup-done'">
      <h2>{{ t('login.signupDoneTitle') }}</h2>
      <p>{{ t('login.signupDoneText') }}</p>
      <p class="spam-warning" role="note">⚠ {{ t('login.spamWarning') }}</p>
      <button type="button" class="submit-button" @click="showLogin">{{ t('login.backToLogin') }}</button>
    </template>

    <!-- Formulaire de connexion (défaut) -->
    <template v-else>
      <h2>{{ t('login.title') }}</h2>
      <form @submit.prevent="submitLogin">
        <div class="form-group">
          <label for="login-email">{{ t('login.email') }}</label>
          <input id="login-email" type="email" v-model="loginEmail" autocomplete="username" required />
        </div>
        <div class="form-group">
          <label for="login-password">{{ t('login.password') }}</label>
          <input id="login-password" type="password" v-model="loginPassword" autocomplete="current-password" required />
        </div>
        <p v-if="loginError" class="login-error">{{ loginError }}</p>
        <button type="submit" class="submit-button" :disabled="isLoggingIn">{{ t('login.submit') }}</button>
      </form>
      <button type="button" class="link-button" @click="showSignup">{{ t('login.noAccountYet') }}</button>
    </template>
  </div>
</template>

<style scoped>
.login-container {
  background: var(--white);
  padding: 25px;
  border-radius: 10px;
  width: 320px;
  font-family: 'Segoe UI', sans-serif;
}

h2 {
  color: var(--red-esigelec);
  text-align: center;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  color: var(--gray-dark);
}

input {
  width: 90%;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 2px solid var(--gray-white-light);
  border-radius: 6px;
  font-size: 14px;
  background-color: var(--white);
  color: var(--gray-dark);
}

input:focus {
  border-color: var(--red-esigelec);
  outline: none;
}

.login-error {
  color: var(--red-esigelec);
  font-size: 0.9em;
  margin: 0 0 10px 0;
}

.login-email-display {
  text-align: center;
  color: var(--gray-dark);
  margin-bottom: 20px;
}

.checking {
  text-align: center;
  color: var(--gray-dark);
}

.signup-hint {
  font-size: 0.85em;
  color: var(--gray-dark);
  margin: 0 0 15px 0;
}

.spam-warning {
  font-size: 0.85em;
  color: var(--gray-dark);
  background: var(--gray-white-light);
  border-left: 4px solid var(--red-esigelec);
  border-radius: 4px;
  padding: 8px 10px;
  margin: 0 0 15px 0;
}

.resend-status {
  font-size: 0.85em;
  color: var(--gray-dark);
  text-align: center;
  margin: 8px 0 0 0;
}

.resend-status.error {
  color: var(--red-esigelec);
}

.submit-button {
  background-color: var(--red-esigelec);
  color: var(--white);
  border: none;
  border-radius: 6px;
  padding: 10px;
  width: 100%;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s ease;
  margin-bottom: 10px;
}

.submit-button:hover {
  background-color: var(--red-btn-hover);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-button {
  background-color: transparent;
  color: var(--red-esigelec);
  border: 2px solid var(--red-esigelec);
  border-radius: 6px;
  padding: 9px;
  width: 100%;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
  margin-bottom: 10px;
}

.secondary-button:hover {
  background-color: var(--red-esigelec);
  color: var(--white);
}

.secondary-button:disabled {
  opacity: 0.6;
  cursor: default;
}

.link-button {
  display: block;
  margin: 0 auto;
  background: none;
  border: none;
  color: var(--red-esigelec);
  font-size: 0.85em;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
  text-align: center;
}
</style>
