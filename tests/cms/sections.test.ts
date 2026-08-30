import { describe, expect, it } from 'vitest'
import { SITE_SECTIONS, isSiteSectionId, sectionIdFromHash } from '@/lib/site-sections'

describe('SITE_SECTIONS', () => {
  it('sigue el orden de montaje de la portada e incluye Projects', () => {
    expect(SITE_SECTIONS.map((s) => s.id)).toEqual([
      'animations', 'projects', 'characters', 'models-3d', 'gamedev', 'illustrations',
    ])
  })

  it('no deja ids repetidos (un ancla, una sección)', () => {
    expect(new Set(SITE_SECTIONS.map((s) => s.id)).size).toBe(SITE_SECTIONS.length)
  })
})

describe('sectionIdFromHash', () => {
  it('acepta solo secciones declaradas', () => {
    expect(sectionIdFromHash('#characters')).toBe('characters')
    expect(sectionIdFromHash('characters')).toBe('characters')
    expect(sectionIdFromHash('#models-3d')).toBe('models-3d')
  })

  it('descarta cualquier otro fragmento', () => {
    expect(sectionIdFromHash('')).toBe('')
    expect(sectionIdFromHash('#')).toBe('')
    expect(sectionIdFromHash('#multimedia')).toBe('')
    expect(sectionIdFromHash('#contacto')).toBe('')
  })

  it('tolera un fragmento mal codificado sin explotar', () => {
    expect(sectionIdFromHash('#%E0%A4%A')).toBe('')
    expect(isSiteSectionId('projects')).toBe(true)
  })
})
