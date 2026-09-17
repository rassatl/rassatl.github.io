import { describe, it, expect, beforeEach } from 'vitest'
import { useLang } from './useLang.js'

describe('useLang', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('resolves a nested translation key', () => {
    const { t, changeLang } = useLang()
    changeLang('fr')
    expect(t('addCompanyForm.addCompany')).toBe('Ajouter une entreprise')
  })

  it('falls back to the key itself when the translation is missing', () => {
    const { t } = useLang()
    expect(t('does.not.exist')).toBe('does.not.exist')
  })

  it('changes the current language and persists it to localStorage', () => {
    const { changeLang, currentLang } = useLang()
    changeLang('en')
    expect(currentLang.currentLang).toBe('en')
    expect(localStorage.getItem('lang')).toBe('en')
  })

  it('ignores an unknown language', () => {
    const { changeLang, currentLang } = useLang()
    changeLang('fr')
    changeLang('xx')
    expect(currentLang.currentLang).toBe('fr')
  })
})
