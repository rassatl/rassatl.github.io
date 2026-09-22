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

  it('never blocks when not connected: nothing to certify, the ajout stays anonymous', () => {
    const wrapper = mountStep()
    expect(wrapper.vm.validate()).toBe(true)
    expect(wrapper.text()).toContain('addCompanyForm.studentHint')
    expect(wrapper.text()).toContain('addCompanyForm.studentNotConnectedHint')
    expect(wrapper.findAll('input[type=radio]')).toHaveLength(0)

    // Optional: can still open the login panel to attribute the submission.
    expect(wrapper.find('.open-login-button').exists()).toBe(true)
  })

  it('blocks validate() until a verified student explicitly picks Oui or Non', async () => {
    studentEmail.value.value = 'ada@groupe-esigelec.org'
    const onUpdate = vi.fn()
    const wrapper = mountStep({ visible: null, 'onUpdate:visible': onUpdate })

    expect(wrapper.text()).toContain('addCompanyForm.studentVerified')
    expect(wrapper.text()).toContain('ada@groupe-esigelec.org')

    // Neither radio pre-checked: no implicit "Non" the student never saw.
    const radios = wrapper.findAll('input[type=radio]')
    expect(radios).toHaveLength(2)
    expect(radios[0].element.checked).toBe(false)
    expect(radios[1].element.checked).toBe(false)
    expect(wrapper.vm.validate()).toBe(false)

    await radios[1].setValue()
    expect(onUpdate).toHaveBeenLastCalledWith(false)
  })

  it('validate() passes once the student has picked either option', () => {
    studentEmail.value.value = 'ada@groupe-esigelec.org'
    expect(mountStep({ visible: true }).vm.validate()).toBe(true)
    expect(mountStep({ visible: false }).vm.validate()).toBe(true)
  })
})
