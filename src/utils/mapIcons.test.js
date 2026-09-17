import { describe, it, expect } from 'vitest'
import { iconForSpeciality, redIcon, blueIcon } from './mapIcons.js'

describe('iconForSpeciality', () => {
  it('returns the blue icon for "IA & Big Data"', () => {
    expect(iconForSpeciality('IA & Big Data')).toBe(blueIcon)
  })

  it('returns the red icon for any other speciality', () => {
    expect(iconForSpeciality('Développement Logiciel, Tests et Qualité')).toBe(redIcon)
  })

  it('returns the red icon for an unknown or empty speciality', () => {
    expect(iconForSpeciality('')).toBe(redIcon)
    expect(iconForSpeciality(undefined)).toBe(redIcon)
  })
})
