import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CompanyStep from './CompanyStep.vue'

const countryList = [
  ['FR', 'France'],
  ['MA', 'Maroc'],
]

const mountStep = (props = {}) =>
  mount(CompanyStep, {
    props: { x: '', y: '', countryList, ...props },
    global: { provide: { t: (key) => key } },
  })

// Fills the "fields" address mode (rather than the default "full address"
// single input) since it exercises name/address/city/country individually.
const fillRequiredFields = async (wrapper, overrides = {}) => {
  const fields = {
    speciality: 'IA & Big Data',
    name: 'Acme',
    country: 'France',
    address: '12 rue de Paris',
    city: 'Paris',
    ...overrides,
  }
  await wrapper.find('#speciality').setValue(fields.speciality)
  await wrapper.find('#name').setValue(fields.name)
  await wrapper.find('#country').setValue(fields.country)
  // Switch to the detailed-fields address mode (default is "full address").
  await wrapper.findAll('[role="tab"]')[1].trigger('click')
  await wrapper.find('#address').setValue(fields.address)
  await wrapper.find('#city').setValue(fields.city)
  if (fields.pc !== undefined) await wrapper.find('#pc').setValue(fields.pc)
}

describe('CompanyStep validateFields', () => {
  it('rejects an empty form with a "company" error', () => {
    const wrapper = mountStep()
    expect(wrapper.vm.validateFields()).toEqual({ data: null, error: 'company' })
  })

  it('rejects when no pin has been placed on the map', async () => {
    const wrapper = mountStep()
    await fillRequiredFields(wrapper)
    expect(wrapper.vm.validateFields()).toEqual({ data: null, error: 'company' })
  })

  it('rejects coordinates outside valid latitude/longitude bounds', async () => {
    const wrapper = mountStep({ x: 999, y: 2.35 })
    await fillRequiredFields(wrapper)
    expect(wrapper.vm.validateFields()).toEqual({ data: null, error: 'company' })
  })

  it('rejects an invalid postal code but accepts a missing one', async () => {
    const wrapper = mountStep({ x: 48.8566, y: 2.3522 })
    await fillRequiredFields(wrapper, { pc: '$$$' })
    expect(wrapper.vm.validateFields()).toEqual({ data: null, error: 'company' })

    const wrapperNoPc = mountStep({ x: 48.8566, y: 2.3522 })
    await fillRequiredFields(wrapperNoPc)
    const { error } = wrapperNoPc.vm.validateFields()
    expect(error).toBeNull()
  })

  it('accepts a valid submission and returns the normalized data', async () => {
    const wrapper = mountStep({ x: 48.8566, y: 2.3522 })
    await fillRequiredFields(wrapper, { pc: '75001' })
    const { data, error } = wrapper.vm.validateFields()
    expect(error).toBeNull()
    expect(data).toMatchObject({
      speciality: 'IA & Big Data',
      name: 'Acme',
      address: '12 rue de Paris',
      city: 'Paris',
      country: 'France',
      pc: '75001',
      x: 48.8566,
      y: 2.3522,
    })
    expect(data.website).toBeUndefined()
  })

  it('normalizes a website missing its protocol', async () => {
    const wrapper = mountStep({ x: 48.8566, y: 2.3522 })
    await fillRequiredFields(wrapper)
    await wrapper.find('#website').setValue('example.com')
    const { data, error } = wrapper.vm.validateFields()
    expect(error).toBeNull()
    expect(data.website).toBe('https://example.com')
  })

  it('rejects a malformed website', async () => {
    const wrapper = mountStep({ x: 48.8566, y: 2.3522 })
    await fillRequiredFields(wrapper)
    await wrapper.find('#website').setValue('not a website')
    expect(wrapper.vm.validateFields()).toEqual({ data: null, error: 'website' })
  })

  it('parses "address, postal code + city, country" from the full-address field', async () => {
    const wrapper = mountStep({ x: 48.8566, y: 2.3522 })
    await wrapper.find('#speciality').setValue('IA & Big Data')
    await wrapper.find('#name').setValue('Acme')
    // Stays in the default "full address" mode for this input.
    await wrapper.find('#fullAddress').setValue('12 rue de Paris, 75001 Paris, France')
    const { data, error } = wrapper.vm.validateFields()
    expect(error).toBeNull()
    expect(data).toMatchObject({
      address: '12 rue de Paris',
      city: 'Paris',
      pc: '75001',
      country: 'France',
    })
  })
})
