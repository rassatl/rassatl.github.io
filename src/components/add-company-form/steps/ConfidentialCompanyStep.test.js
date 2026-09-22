import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfidentialCompanyStep from './ConfidentialCompanyStep.vue'

const countryList = [
  ['FR', 'France'],
  ['MA', 'Maroc'],
]

const mountStep = (props = {}) =>
  mount(ConfidentialCompanyStep, {
    props: { x: '', y: '', countryList, ...props },
    global: { provide: { t: (key) => key } },
  })

const fillRequiredFields = async (wrapper, overrides = {}) => {
  const fields = {
    speciality: 'IA & Big Data',
    country: 'France',
    city: 'Paris',
    ...overrides,
  }
  await wrapper.find('#speciality').setValue(fields.speciality)
  await wrapper.find('#country').setValue(fields.country)
  await wrapper.find('#city').setValue(fields.city)
}

describe('ConfidentialCompanyStep validateFields', () => {
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

  it('rejects an incomplete speciality/country/city', async () => {
    const wrapper = mountStep({ x: 48.8566, y: 2.3522 })
    await fillRequiredFields(wrapper, { city: '' })
    expect(wrapper.vm.validateFields()).toEqual({ data: null, error: 'company' })
  })

  it('accepts a valid submission and returns the normalized data', async () => {
    const wrapper = mountStep({ x: 48.8566, y: 2.3522 })
    await fillRequiredFields(wrapper)
    const { data, error } = wrapper.vm.validateFields()
    expect(error).toBeNull()
    expect(data).toEqual({
      speciality: 'IA & Big Data',
      city: 'Paris',
      country: 'France',
      x: 48.8566,
      y: 2.3522,
    })
  })

  it('trims and collapses whitespace in the city', async () => {
    const wrapper = mountStep({ x: 48.8566, y: 2.3522 })
    await fillRequiredFields(wrapper, { city: '  Lyon   City  ' })
    const { data, error } = wrapper.vm.validateFields()
    expect(error).toBeNull()
    expect(data.city).toBe('Lyon City')
  })
})
