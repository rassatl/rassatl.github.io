import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import StudentStep from './StudentStep.vue'

const { studentEmail } = vi.hoisted(() => ({ studentEmail: { value: null } }))

// Sidesteps Firebase and the shared login-modal state: StudentStep only
// needs to know whether the student email is verified. The connect/sign-up
// flow itself is covered by LoginForm.test.js.
vi.mock('../../../composables/useAuth.js', async () => {
  const { ref } = await import('vue')
  studentEmail.value = ref(null)
  return { useAuth: () => ({ studentEmail: studentEmail.value }) }
})
const openLoginModal = vi.fn()
vi.mock('../../../composables/useLoginModal.js', () => ({
  useLoginModal: () => ({ open: openLoginModal }),
}))

const mountStep = (props = {}) =>
  mount(StudentStep, { props, global: { provide: { t: (key) => key } } })

describe('StudentStep', () => {
  beforeEach(() => {
    studentEmail.value.value = null
    openLoginModal.mockReset()
  })

  it('never blocks: the step has no validate() the parent must call', () => {
    const wrapper = mountStep()
    expect(wrapper.vm.validate).toBeUndefined()
  })

  it('explains the ajout stays anonymous by default when not connected', () => {
    const wrapper = mountStep()
    expect(wrapper.text()).toContain('addCompanyForm.studentHint')
    expect(wrapper.text()).toContain('addCompanyForm.studentNotConnectedHint')
    expect(wrapper.find('.visibility-checkbox').exists()).toBe(false)

    // Optional: can still open the login panel to attribute the submission.
    expect(wrapper.find('.open-login-button').exists()).toBe(true)
  })

  it('offers the visibility choice, private by default, once a verified student is connected', async () => {
    studentEmail.value.value = 'ada@groupe-esigelec.org'
    const onUpdate = vi.fn()
    const wrapper = mountStep({ visible: false, 'onUpdate:visible': onUpdate })

    expect(wrapper.text()).toContain('addCompanyForm.studentVerified')
    expect(wrapper.text()).toContain('ada@groupe-esigelec.org')

    const checkbox = wrapper.find('.visibility-checkbox')
    expect(checkbox.element.checked).toBe(false)

    await checkbox.setValue(true)
    expect(onUpdate).toHaveBeenLastCalledWith(true)
  })
})
