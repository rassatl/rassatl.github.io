import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import LoginForm from './LoginForm.vue'

const { user, isAdmin, checkingAdmin, studentEmail } = vi.hoisted(() => ({
  user: { value: null },
  isAdmin: { value: false },
  checkingAdmin: { value: false },
  studentEmail: { value: null },
}))

const login = vi.fn()
const logout = vi.fn()
const signup = vi.fn()
const resendVerificationEmail = vi.fn()
const refreshUser = vi.fn()

// Sidesteps Firebase: LoginForm only reacts to these refs/actions, driven
// directly by each test rather than through a real sign-in.
vi.mock('../../composables/useAuth.js', async () => {
  const { ref } = await import('vue')
  user.value = ref(null)
  isAdmin.value = ref(false)
  checkingAdmin.value = ref(false)
  studentEmail.value = ref(null)
  return {
    useAuth: () => ({
      user: user.value, isAdmin: isAdmin.value, checkingAdmin: checkingAdmin.value, studentEmail: studentEmail.value,
      login, logout, signup, resendVerificationEmail, refreshUser,
    }),
  }
})
vi.mock('../../composables/useErrorLogs.js', () => ({
  useErrorLogs: () => ({ logError: vi.fn() }),
}))

const mountForm = () => mount(LoginForm, { global: { provide: { t: (key) => key } } })

const goToSignup = async (wrapper) => {
  await wrapper.find('.link-button').trigger('click')
}

const fillSignup = async (wrapper, { email = 'ada@groupe-esigelec.org', password = 'secret123', confirm = password } = {}) => {
  await wrapper.find('#signup-email').setValue(email)
  await wrapper.find('#signup-password').setValue(password)
  await wrapper.find('#signup-confirm-password').setValue(confirm)
  await wrapper.find('form').trigger('submit.prevent')
  await flushPromises()
}

describe('LoginForm', () => {
  beforeEach(() => {
    user.value.value = null
    isAdmin.value.value = false
    checkingAdmin.value.value = false
    studentEmail.value.value = null
    login.mockReset()
    logout.mockReset().mockResolvedValue(undefined)
    signup.mockReset()
    resendVerificationEmail.mockReset()
    refreshUser.mockReset().mockResolvedValue(undefined)
  })

  describe('nobody signed in', () => {
    it('shows the login form by default, with a link to create an account', () => {
      const wrapper = mountForm()
      expect(wrapper.find('#login-email').exists()).toBe(true)
      expect(wrapper.find('#signup-email').exists()).toBe(false)
      expect(wrapper.text()).toContain('login.noAccountYet')
    })

    it('switches to the signup form and back', async () => {
      const wrapper = mountForm()
      await goToSignup(wrapper)
      expect(wrapper.find('#signup-email').exists()).toBe(true)
      expect(wrapper.text()).toContain('login.signupHint')

      await wrapper.find('.link-button').trigger('click')
      expect(wrapper.find('#login-email').exists()).toBe(true)
    })

    it('shows a generic error on failed login, without calling logError (routine, not a bug)', async () => {
      login.mockRejectedValue(new Error('wrong password'))
      const wrapper = mountForm()
      await wrapper.find('#login-email').setValue('admin@example.com')
      await wrapper.find('#login-password').setValue('nope')
      await wrapper.find('form').trigger('submit.prevent')
      await flushPromises()

      expect(wrapper.text()).toContain('login.error')
    })

    it('rejects a signup email outside the student domain without calling signup()', async () => {
      const wrapper = mountForm()
      await goToSignup(wrapper)
      await fillSignup(wrapper, { email: 'ada@gmail.com' })

      expect(signup).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain('addCompanyForm.studentEmailInvalid')
    })

    it('rejects mismatched passwords without calling signup()', async () => {
      const wrapper = mountForm()
      await goToSignup(wrapper)
      await fillSignup(wrapper, { password: 'secret123', confirm: 'other456' })

      expect(signup).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain('login.passwordMismatch')
    })

    it('shows a confirmation after a successful signup, warning about spam, then can go back to login', async () => {
      signup.mockResolvedValue(undefined)
      const wrapper = mountForm()
      await goToSignup(wrapper)
      await fillSignup(wrapper)

      expect(signup).toHaveBeenCalledWith('ada@groupe-esigelec.org', 'secret123')
      expect(wrapper.text()).toContain('login.signupDoneTitle')
      expect(wrapper.text()).toContain('login.spamWarning')

      await wrapper.find('.submit-button').trigger('click')
      expect(wrapper.find('#login-email').exists()).toBe(true)
    })

    it('maps a known Firebase error code to a friendly message and stays on the signup form', async () => {
      signup.mockRejectedValue(Object.assign(new Error('in use'), { code: 'auth/email-already-in-use' }))
      const wrapper = mountForm()
      await goToSignup(wrapper)
      await fillSignup(wrapper)

      expect(wrapper.text()).toContain('login.emailAlreadyInUse')
      expect(wrapper.find('#signup-email').exists()).toBe(true)
    })

    it('falls back to a generic error for an unmapped failure', async () => {
      signup.mockRejectedValue(new Error('boom'))
      const wrapper = mountForm()
      await goToSignup(wrapper)
      await fillSignup(wrapper)

      expect(wrapper.text()).toContain('login.signupError')
    })

    it('never shows the "email not verified" panel while signup is submitting, even though the account is briefly signed in', async () => {
      let resolveSignup
      signup.mockImplementation(() => new Promise((resolve) => {
        // Mirrors createUserWithEmailAndPassword momentarily signing the new,
        // unverified account in before useAuth.signup() signs it back out.
        user.value.value = { uid: 'new', email: 'ada@groupe-esigelec.org', emailVerified: false }
        resolveSignup = resolve
      }))
      const wrapper = mountForm()
      await goToSignup(wrapper)
      await wrapper.find('#signup-email').setValue('ada@groupe-esigelec.org')
      await wrapper.find('#signup-password').setValue('secret123')
      await wrapper.find('#signup-confirm-password').setValue('secret123')
      wrapper.find('form').trigger('submit.prevent')
      await nextTick()

      expect(wrapper.find('#signup-email').exists()).toBe(true)
      expect(wrapper.text()).not.toContain('login.notVerifiedTitle')

      resolveSignup()
      await flushPromises()
      user.value.value = null // useAuth.signup()'s own signOut()
      await nextTick()

      expect(wrapper.text()).toContain('login.signupDoneTitle')
    })
  })

  describe('signed in', () => {
    it('shows the admin panel and logs out on click', async () => {
      user.value.value = { uid: 'a1', email: 'admin@example.com', emailVerified: true }
      isAdmin.value.value = true
      const wrapper = mountForm()

      expect(wrapper.text()).toContain('login.loggedInAs')
      expect(wrapper.text()).toContain('admin@example.com')

      await wrapper.find('.submit-button').trigger('click')
      expect(logout).toHaveBeenCalled()
    })

    it('shows the verified-student panel', () => {
      user.value.value = { uid: 's1', email: 'ada@groupe-esigelec.org', emailVerified: true }
      studentEmail.value.value = 'ada@groupe-esigelec.org'
      const wrapper = mountForm()

      expect(wrapper.text()).toContain('login.loggedInAsStudent')
      expect(wrapper.text()).toContain('ada@groupe-esigelec.org')
    })

    it('shows a transient "checking" state instead of the not-verified panel while the admin check is pending', () => {
      user.value.value = { uid: 'a1', email: 'admin@example.com', emailVerified: false }
      checkingAdmin.value.value = true
      const wrapper = mountForm()

      expect(wrapper.text()).toContain('login.checking')
      expect(wrapper.text()).not.toContain('login.notVerifiedTitle')
    })

    it('shows the not-verified panel, with resend/refresh/logout, once the admin check is settled', async () => {
      user.value.value = { uid: 's1', email: 'ada@groupe-esigelec.org', emailVerified: false }
      resendVerificationEmail.mockResolvedValue(undefined)
      const wrapper = mountForm()

      expect(wrapper.text()).toContain('login.notVerifiedTitle')
      expect(wrapper.text()).toContain('ada@groupe-esigelec.org')
      expect(wrapper.text()).toContain('login.spamWarning')

      await wrapper.findAll('button').find((b) => b.text() === 'login.resendVerification').trigger('click')
      expect(resendVerificationEmail).toHaveBeenCalled()
      await flushPromises()
      expect(wrapper.text()).toContain('login.resendVerificationSent')

      await wrapper.findAll('button').find((b) => b.text() === 'login.iVerified').trigger('click')
      expect(refreshUser).toHaveBeenCalled()

      await wrapper.find('.link-button').trigger('click')
      expect(logout).toHaveBeenCalled()
    })

    it('shows a resend error without pretending it worked', async () => {
      user.value.value = { uid: 's1', email: 'ada@groupe-esigelec.org', emailVerified: false }
      resendVerificationEmail.mockRejectedValue(new Error('rate limited'))
      const wrapper = mountForm()

      await wrapper.findAll('button').find((b) => b.text() === 'login.resendVerification').trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('login.resendVerificationError')
      expect(wrapper.text()).not.toContain('login.resendVerificationSent')
    })
  })
})
