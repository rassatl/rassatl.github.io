import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ContactsStep from './ContactsStep.vue'

// Sidesteps the firebase-backed usePendingCompanies composable: ContactsStep
// only calls fetchContacts, and only when a pendingCompany prop is given.
vi.mock('../../../composables/usePendingCompanies.js', () => ({
  usePendingCompanies: () => ({ fetchContacts: vi.fn().mockResolvedValue([]) }),
}))

const mountStep = (props = {}) =>
  mount(ContactsStep, {
    props,
    global: { provide: { t: (key) => key } },
  })

const fillContact = async (wrapper, index, contact) => {
  await wrapper.find(`#contact-firstName-${index}`).setValue(contact.firstName)
  await wrapper.find(`#contact-lastName-${index}`).setValue(contact.lastName)
  await wrapper.find(`#contact-role-${index}`).setValue(contact.role)
  await wrapper.find(`#contact-email-${index}`).setValue(contact.email)
  if (contact.phone !== undefined) await wrapper.find(`#contact-phone-${index}`).setValue(contact.phone)
}

describe('ContactsStep validate', () => {
  it('rejects an incomplete contact', async () => {
    const wrapper = mountStep()
    await wrapper.find('#contact-firstName-0').setValue('Ada')
    expect(wrapper.vm.validate()).toBeNull()
  })

  it('rejects an invalid email', async () => {
    const wrapper = mountStep()
    await fillContact(wrapper, 0, { firstName: 'Ada', lastName: 'Lovelace', role: 'CTO', email: 'not-an-email' })
    expect(wrapper.vm.validate()).toBeNull()
  })

  it('accepts a fully filled contact and trims/normalizes whitespace', async () => {
    const wrapper = mountStep()
    await fillContact(wrapper, 0, {
      firstName: '  Ada  ',
      lastName: 'Lovelace',
      role: 'CTO',
      email: ' ada@example.com ',
    })
    expect(wrapper.vm.validate()).toEqual([
      { firstName: 'Ada', lastName: 'Lovelace', role: 'CTO', email: 'ada@example.com', phone: '' },
    ])
  })

  it('validates every contact block, not just the first', async () => {
    const wrapper = mountStep()
    await fillContact(wrapper, 0, { firstName: 'Ada', lastName: 'Lovelace', role: 'CTO', email: 'ada@example.com' })
    await wrapper.find('.add-contact-button').trigger('click')
    expect(wrapper.vm.validate()).toBeNull()

    await fillContact(wrapper, 1, { firstName: 'Alan', lastName: 'Turing', role: 'CEO', email: 'alan@example.com' })
    expect(wrapper.vm.validate()).toHaveLength(2)
  })

  it('does not allow removing the last remaining contact', async () => {
    const wrapper = mountStep()
    expect(wrapper.findAll('.contact-block')).toHaveLength(1)
    expect(wrapper.find('.remove-contact-button').exists()).toBe(false)
  })
})
