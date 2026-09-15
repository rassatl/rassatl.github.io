<script setup>
import { ref, inject } from 'vue'
import { useAuth } from '../../composables/useAuth.js'

const t = inject('t')
const { login, logout, isAdmin, user } = useAuth()

const emit = defineEmits(['close'])

const email = ref('')
const password = ref('')
const error = ref('')
const isSubmitting = ref(false)

const submit = async () => {
  error.value = ''
  isSubmitting.value = true
  try {
    await login(email.value, password.value)
    email.value = ''
    password.value = ''
    emit('close')
  } catch (e) {
    error.value = t('login.error')
  } finally {
    isSubmitting.value = false
  }
}

const handleLogout = async () => {
  await logout()
  emit('close')
}
</script>

<template>
  <div class="login-container">
    <template v-if="!isAdmin">
      <h2>{{ t('login.title') }}</h2>
      <form @submit.prevent="submit">
        <div class="form-group">
          <label for="login-email">{{ t('login.email') }}</label>
          <input id="login-email" type="email" v-model="email" autocomplete="username" required />
        </div>
        <div class="form-group">
          <label for="login-password">{{ t('login.password') }}</label>
          <input id="login-password" type="password" v-model="password" autocomplete="current-password" required />
        </div>
        <p v-if="error" class="login-error">{{ error }}</p>
        <button type="submit" class="submit-button" :disabled="isSubmitting">{{ t('login.submit') }}</button>
      </form>
    </template>
    <template v-else>
      <h2>{{ t('login.loggedInAs') }}</h2>
      <p class="login-email-display">{{ user?.email }}</p>
      <button type="button" class="submit-button" @click="handleLogout">{{ t('login.logout') }}</button>
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
}

.submit-button:hover {
  background-color: var(--red-btn-hover);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
