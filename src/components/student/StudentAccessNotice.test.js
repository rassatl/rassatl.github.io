import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import StudentAccessNotice from './StudentAccessNotice.vue'

const open = vi.fn()
vi.mock('../../composables/useLoginModal.js', () => ({
  useLoginModal: () => ({ open }),
}))

describe('StudentAccessNotice', () => {
  it('explains that signing in is required and opens the shared login panel on click', async () => {
    open.mockReset()
    const wrapper = mount(StudentAccessNotice, { global: { provide: { t: (key) => key } } })

    expect(wrapper.text()).toContain('addCompanyForm.studentNotConnectedHint')

    await wrapper.find('.open-login-button').trigger('click')
    expect(open).toHaveBeenCalledTimes(1)
  })
})
