import { describe, expect, it } from 'vitest'
import { COLLECTIONS, collectionOf } from '@/lib/cms/collections'
import {
  allKeysOf,
  fieldKeysOf,
  isEmptyMedia,
  itemKey,
  mediaKeysOf,
  newId,
  readSettings,
} from '@/lib/cms/collection'

describe('COLLECTIONS', () => {
  it('declara las seis colecciones dinámicas', () => {
    expect(Object.keys(COLLECTIONS).sort()).toEqual([
      'about-carousel', 'char', 'hero', 'hero-main', 'hero-sub', 'proj',
    ])
  })

  it('los carruseles de portada rotan y tienen tope de 4', () => {
    expect(COLLECTIONS['hero'].duration).toBe(true)
    expect(COLLECTIONS['hero'].max).toBe(4)
    expect(COLLECTIONS['hero'].concepts).toBeUndefined()
  })

  it('proj y char declaran campos y conceptos', () => {
    expect(COLLECTIONS['proj'].concepts).toBe(3)
    expect(COLLECTIONS['proj'].fields?.map((f) => f.key)).toEqual(['title', 'start_date', 'summary'])
    expect(COLLECTIONS['char'].concepts).toBe(3)
    expect(COLLECTIONS['char'].fields?.map((f) => f.key)).toEqual(['name', 'role', 'desc'])
  })

  it('legacyBase conserva el infijo .slide de los carruseles', () => {
    expect(COLLECTIONS['hero'].legacyBase).toBe('hero.slide')
    expect(COLLECTIONS['about-carousel'].legacyBase).toBe('about-carousel.slide')
    expect(COLLECTIONS['proj'].legacyBase).toBe('proj')
  })
})

describe('collectionOf', () => {
  it('resuelve la spec desde una clave de media', () => {
    expect(collectionOf('proj#k3f9')?.prefix).toBe('proj')
  })

  it('resuelve la spec desde una clave de campo o de concepto', () => {
    expect(collectionOf('proj#k3f9::title')?.prefix).toBe('proj')
    expect(collectionOf('char#m2b1::c2')?.prefix).toBe('char')
  })

  it('no confunde prefijos que comparten raíz', () => {
    expect(collectionOf('hero-main#a1c7')?.prefix).toBe('hero-main')
    expect(collectionOf('hero#a1c7')?.prefix).toBe('hero')
  })

  it('devuelve null para claves que no son de colección', () => {
    expect(collectionOf('illustration#3')).toBeNull()
    expect(collectionOf('proj.settings')).toBeNull()
    expect(collectionOf('proj.soft#1')).toBeNull()
  })
})

describe('newId', () => {
  it('genera un id base36 de 6 caracteres', () => {
    expect(newId([])).toMatch(/^[a-z0-9]{6}$/)
  })

  it('evita colisionar con los ids existentes', () => {
    const rand = (() => {
      const queue = ['aaaaaa', 'aaaaaa', 'bbbbbb']
      return () => queue.shift()!
    })()
    expect(newId(['aaaaaa'], rand)).toBe('bbbbbb')
  })
})

describe('readSettings', () => {
  it('lee ids y duración del formato nuevo', () => {
    const items = { 'hero.settings': '{"ids":["a1","b2"],"duration":9000}' }
    expect(readSettings(items, 'hero')).toEqual({ ids: ['a1', 'b2'], duration: 9000 })
  })

  it('devuelve ids vacíos si la clave no existe', () => {
    expect(readSettings({}, 'hero')).toEqual({ ids: [] })
  })

  it('tolera JSON inválido sin lanzar', () => {
    expect(readSettings({ 'hero.settings': '{roto' }, 'hero')).toEqual({ ids: [] })
  })

  it('ignora un ids que no sea array de strings', () => {
    expect(readSettings({ 'hero.settings': '{"ids":[1,2]}' }, 'hero')).toEqual({ ids: [] })
  })

  it('no interpreta el count legacy como ids', () => {
    expect(readSettings({ 'proj.settings': '{"count":4}' }, 'proj')).toEqual({ ids: [] })
  })
})

describe('helpers de clave', () => {
  const proj = COLLECTIONS['proj']
  const hero = COLLECTIONS['hero']

  it('itemKey usa el prefijo, no el legacyBase', () => {
    expect(itemKey(hero, 'a1c7')).toBe('hero#a1c7')
    expect(itemKey(proj, 'k3f9')).toBe('proj#k3f9')
  })

  it('mediaKeysOf incluye el principal y los conceptos', () => {
    expect(mediaKeysOf(proj, 'k3f9')).toEqual([
      'proj#k3f9', 'proj#k3f9::c0', 'proj#k3f9::c1', 'proj#k3f9::c2',
    ])
  })

  it('mediaKeysOf de un carrusel es solo el principal', () => {
    expect(mediaKeysOf(hero, 'a1c7')).toEqual(['hero#a1c7'])
  })

  it('fieldKeysOf lista los campos declarados', () => {
    expect(fieldKeysOf(proj, 'k3f9')).toEqual([
      'proj#k3f9::title', 'proj#k3f9::start_date', 'proj#k3f9::summary',
    ])
  })

  it('allKeysOf es la unión de media y campos', () => {
    expect(allKeysOf(proj, 'k3f9')).toEqual([
      'proj#k3f9', 'proj#k3f9::c0', 'proj#k3f9::c1', 'proj#k3f9::c2',
      'proj#k3f9::title', 'proj#k3f9::start_date', 'proj#k3f9::summary',
    ])
  })
})

describe('isEmptyMedia', () => {
  it('trata como vacíos los placeholders de background sin URL', () => {
    expect(isEmptyMedia('')).toBe(true)
    expect(isEmptyMedia('   ')).toBe(true)
    expect(isEmptyMedia(undefined)).toBe(true)
    expect(isEmptyMedia(null)).toBe(true)
    expect(isEmptyMedia('url("")')).toBe(true)
    expect(isEmptyMedia('url()')).toBe(true)
  })

  it('trata como vacío un placeholder por nombre de archivo', () => {
    expect(isEmptyMedia('/img/placeholder.webp')).toBe(true)
  })

  it('acepta una URL real', () => {
    expect(isEmptyMedia('https://res.cloudinary.com/x/a.webp')).toBe(false)
  })
})
