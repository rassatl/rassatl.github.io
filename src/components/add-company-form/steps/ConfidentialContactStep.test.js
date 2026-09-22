import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfidentialContactStep from './ConfidentialContactStep.vue'

// Sidesteps the firebase-backed usePendingCompanies composable: the step
// only calls fetchConfidentialContact, and only when a pendingCompany prop
// is given (review mode).
vi.mock('../../../composables/usePendingCompanies.js', () => ({
  usePendingCompanies: () => ({ fetchConfidentialContact: vi.fn().mockResolvedValue([]) }),
}))

const mountStep = (props = {}) =>
  mount(ConfidentialContactStep, {
    props,
    global: { provide: { t: (key) => key } },
  })

describe('ConfidentialContactStep validate', () => {
  it('accepts an entirely empty form: every field is optional', () => {
    const wrapper = mountStep()
    expect(wrapper.vm.validate()).toEqual({})
  })

  it('accepts a single field filled in, trimmed and normalized', async () => {
    const wrapper = mountStep()
    await wrapper.find('#contact-personal-email').setValue('  ada@example.com  ')
    expect(wrapper.vm.validate()).toEqual({ personalEmail: 'ada@example.com' })
  })

  it('accepts several fields at once, omitting the empty ones', async () => {
    const wrapper = mountStep()
    await wrapper.find('#contact-whatsapp').setValue('+33 6 00 00 00 00')
    await wrapper.find('#contact-linkedin').setValue('https://www.linkedin.com/in/ada')
    expect(wrapper.vm.validate()).toEqual({
      whatsapp: '+33 6 00 00 00 00',
      linkedin: 'https://www.linkedin.com/in/ada',
    })
  })

  it('does not verify the format of any field (nothing is checked)', () => {
    const wrapper = mountStep()
    return wrapper.find('#contact-school-email').setValue('not-an-email-at-all').then(() => {
      expect(wrapper.vm.validate()).toEqual({ schoolEmail: 'not-an-email-at-all' })
    })
  })
})
