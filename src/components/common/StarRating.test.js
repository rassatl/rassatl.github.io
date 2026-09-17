import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StarRating from './StarRating.vue'

describe('StarRating', () => {
  it('renders `max` stars, filled up to modelValue', () => {
    const wrapper = mount(StarRating, { props: { modelValue: 3, max: 5 } })
    const stars = wrapper.findAll('.star')
    expect(stars).toHaveLength(5)
    expect(stars.filter((s) => s.classes('filled'))).toHaveLength(3)
  })

  it('emits the clicked star value', async () => {
    const wrapper = mount(StarRating, { props: { modelValue: 2, max: 5 } })
    await wrapper.findAll('.star')[3].trigger('click')
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([4])
  })

  it('toggles the rating off when clicking the already-selected star', async () => {
    const wrapper = mount(StarRating, { props: { modelValue: 3, max: 5 } })
    await wrapper.findAll('.star')[2].trigger('click')
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([0])
  })

  it('does not emit when readonly', async () => {
    const wrapper = mount(StarRating, { props: { modelValue: 3, max: 5, readonly: true } })
    await wrapper.findAll('.star')[0].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
