import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import StudentStep from './StudentStep.vue'

const { studentEmail, sendStudentLink, logout } = vi.hoisted(() => ({
  studentEmail: { value: null },
  sendStudentLink: vi.fn(),
  logout: vi.fn(),
}))

// Sidesteps Firebase: StudentStep only needs the verified-email state and the
// two auth actions, which are mocked so each test can drive them.
vi.mock('../../../composables/useAuth.js', async () => {
  const { ref } = await import('vue')
  studentEmail.value = ref(null)
  return { useAuth: () => ({ studentEmail: studentEmail.value, sendStudentLink, logout }) }
})
vi.mock('../../../composables/useErrorLogs.js', () => ({
  useErrorLogs: () => ({ logError: vi.fn() }),
}))

const mountStep = () =>
  mount(StudentStep, { global: { provide: { t: (key) => key } } })

describe('StudentStep', () => {
  beforeEach(() => {
    studentEmail.value.value = null
    sendStudentLink.mockReset().mockResolvedValue(undefined)
    logout.mockReset().mockResolvedValue(undefined)
  })

  it('is invalid until the student email has been verified', () => {
    const wrapper = mountStep()
    expect(wrapper.vm.validate()).toBe(false)

    studentEmail.value.value = 'ada@groupe-esigelec.org'
    expect(wrapper.vm.validate()).toBe(true)
  })

  it('always tells the student the email is not displayed on the site', () => {
    const wrapper = mountStep()
    expect(wrapper.text()).toContain('addCompanyForm.studentPrivacyNote')
  })

  it('keeps the email private by default and reports the student choosing to show it', async () => {
    const onUpdate = vi.fn()
    const wrapper = mount(StudentStep, {
      props: { visible: false, 'onUpdate:visible': onUpdate },
      global: { provide: { t: (key) => key } },
    })
    const checkbox = wrapper.find('.visibility-checkbox')
    expect(checkbox.element.checked).toBe(false)

    await checkbox.setValue(true)
    expect(onUpdate).toHaveBeenLastCalledWith(true)

    await checkbox.setValue(false)
    expect(onUpdate).toHaveBeenLastCalledWith(false)
  })

  it('still offers the choice once the email is verified', () => {
    studentEmail.value.value = 'ada@groupe-esigelec.org'
    const wrapper = mountStep()
    expect(wrapper.find('.visibility-checkbox').exists()).toBe(true)
  })

  it('rejects an address outside the student domain without sending anything', async () => {
    const wrapper = mountStep()
    await wrapper.find('#student-email').setValue('ada@gmail.com')
    await wrapper.find('.send-button').trigger('click')

    expect(sendStudentLink).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('addCompanyForm.studentEmailInvalid')
  })

  it('sends the verification link to a student address and confirms it', async () => {
    const wrapper = mountStep()
    await wrapper.find('#student-email').setValue('ada@groupe-esigelec.org')
    await wrapper.find('.send-button').trigger('click')
    await flushPromises()

    expect(sendStudentLink).toHaveBeenCalledWith('ada@groupe-esigelec.org')
    expect(wrapper.text()).toContain('addCompanyForm.studentLinkSentTo')
    expect(wrapper.text()).toContain('ada@groupe-esigelec.org')
    // Still not verified: only the link in the email can do that.
    expect(wrapper.vm.validate()).toBe(false)
  })

  it('shows an error, and no confirmation, when the link cannot be sent', async () => {
    sendStudentLink.mockRejectedValue(new Error('network'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mountStep()
    await wrapper.find('#student-email').setValue('ada@groupe-esigelec.org')
    await wrapper.find('.send-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('addCompanyForm.studentLinkError')
    expect(wrapper.text()).not.toContain('addCompanyForm.studentLinkSentTo')
  })

  it('shows the verified address and lets the student switch to another one', async () => {
    studentEmail.value.value = 'ada@groupe-esigelec.org'
    const wrapper = mountStep()

    expect(wrapper.find('#student-email').exists()).toBe(false)
    expect(wrapper.text()).toContain('ada@groupe-esigelec.org')

    await wrapper.find('.link-button').trigger('click')
    expect(logout).toHaveBeenCalled()
  })
})
