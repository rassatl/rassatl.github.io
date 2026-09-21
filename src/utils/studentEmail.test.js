import { describe, it, expect } from 'vitest'
import { isStudentEmail } from './studentEmail.js'

describe('isStudentEmail', () => {
  it('accepts an address on the student domain, ignoring case and surrounding spaces', () => {
    expect(isStudentEmail('ada.lovelace@groupe-esigelec.org')).toBe(true)
    expect(isStudentEmail('  Ada.Lovelace@Groupe-ESIGELEC.org ')).toBe(true)
  })

  it('rejects other domains, including look-alikes and subdomains', () => {
    expect(isStudentEmail('ada@gmail.com')).toBe(false)
    expect(isStudentEmail('ada@esigelec.fr')).toBe(false)
    expect(isStudentEmail('ada@groupe-esigelec.org.evil.com')).toBe(false)
    expect(isStudentEmail('ada@evil-groupe-esigelec.org')).toBe(false)
    expect(isStudentEmail('ada@mail.groupe-esigelec.org')).toBe(false)
    expect(isStudentEmail('ada@groupe-esigelecXorg')).toBe(false)
  })

  it('rejects an empty value or a missing local part', () => {
    expect(isStudentEmail('')).toBe(false)
    expect(isStudentEmail(undefined)).toBe(false)
    expect(isStudentEmail('@groupe-esigelec.org')).toBe(false)
  })
})
