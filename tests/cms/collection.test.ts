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

  it('proj rota solo (intervalo editable); char no', () => {
    expect(COLLECTIONS['proj'].duration).toBe(true)
    expect(COLLECTIONS['char'].duration).toBeUndefined()
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

import { planCommit } from '@/lib/cms/collection'

describe('planCommit', () => {
  const proj = COLLECTIONS['proj']
  const hero = COLLECTIONS['hero']

  const items = {
    'proj.settings': '{"ids":["a","b","c"]}',
    'proj#a': 'https://cdn/a.webp',
    'proj#a::title': 'Alpha',
    'proj#a::c0': 'https://cdn/a-c0.webp',
    'proj#b': 'https://cdn/b.webp',
    'proj#b::title': 'Beta',
    'proj#c': 'https://cdn/c.webp',
    'proj#c::title': 'Gamma',
  }

  it('un reordenamiento puro escribe SOLO la clave de settings', () => {
    const plan = planCommit(proj, ['a', 'b', 'c'], ['b', 'a', 'c'], items)
    expect(Object.keys(plan.payload)).toEqual(['proj.settings'])
    expect(plan.payload['proj.settings']).toBe('{"ids":["b","a","c"]}')
  })

  it('un reordenamiento puro no archiva ni borra nada', () => {
    const plan = planCommit(proj, ['a', 'b', 'c'], ['c', 'b', 'a'], items)
    expect(plan.archiveKeys).toEqual([])
    expect(plan.deleteKeys).toEqual([])
  })

  it('borrar el item del medio solo toca sus propias claves', () => {
    const plan = planCommit(proj, ['a', 'b', 'c'], ['a', 'c'], items)
    expect(plan.payload['proj.settings']).toBe('{"ids":["a","c"]}')
    expect(plan.payload['proj#b']).toBe('')
    expect(plan.payload['proj#b::title']).toBe('')
    expect(plan.payload['proj#a']).toBeUndefined()
    expect(plan.payload['proj#c']).toBeUndefined()
    expect(plan.payload['proj#a::title']).toBeUndefined()
  })

  it('borrar archiva las claves de media con contenido, una sola vez', () => {
    const plan = planCommit(proj, ['a', 'b', 'c'], ['b', 'c'], items)
    expect(plan.archiveKeys).toEqual(['proj#a', 'proj#a::c0'])
  })

  it('borrar no archiva slots de media vacíos', () => {
    const plan = planCommit(proj, ['a', 'b', 'c'], ['a', 'c'], items)
    expect(plan.archiveKeys).toEqual(['proj#b'])
  })

  it('deleteKeys cubre media, conceptos y campos del item borrado', () => {
    const plan = planCommit(proj, ['a', 'b'], ['b'], items)
    expect(plan.deleteKeys).toEqual([
      'proj#a', 'proj#a::c0', 'proj#a::c1', 'proj#a::c2',
      'proj#a::title', 'proj#a::start_date', 'proj#a::summary',
    ])
  })

  it('agregar un item escribe solo settings: el media lo escribe el picker', () => {
    const plan = planCommit(proj, ['a'], ['a', 'nuevo'], items)
    expect(Object.keys(plan.payload)).toEqual(['proj.settings'])
    expect(plan.payload['proj.settings']).toBe('{"ids":["a","nuevo"]}')
  })

  it('vaciar la colección borra todos los items', () => {
    const plan = planCommit(proj, ['a', 'b', 'c'], [], items)
    expect(plan.payload['proj.settings']).toBe('{"ids":[]}')
    expect(plan.archiveKeys).toEqual(['proj#a', 'proj#a::c0', 'proj#b', 'proj#c'])
  })

  it('borrar de una colección sin conceptos ni campos solo toca su clave de media', () => {
    const heroItems = {
      'hero.settings': '{"ids":["x","y"],"duration":7000}',
      'hero#x': 'https://cdn/x.webp',
      'hero#y': 'https://cdn/y.webp',
    }
    const plan = planCommit(hero, ['x', 'y'], ['y'], heroItems, 7000)
    expect(plan.archiveKeys).toEqual(['hero#x'])
    expect(plan.deleteKeys).toEqual(['hero#x'])
    expect(plan.payload).toEqual({
      'hero.settings': '{"ids":["y"],"duration":7000}',
      'hero#x': '',
    })
  })

  it('persiste la duración en las colecciones que rotan', () => {
    const plan = planCommit(hero, ['x'], ['x'], { 'hero#x': 'https://cdn/x.webp' }, 9000)
    expect(plan.payload['hero.settings']).toBe('{"ids":["x"],"duration":9000}')
  })

  it('ignora la duración en las colecciones que no rotan', () => {
    const char = COLLECTIONS['char']
    const plan = planCommit(char, ['a'], ['a'], { 'char#a': 'https://cdn/a.webp' }, 9000)
    expect(plan.payload['char.settings']).toBe('{"ids":["a"]}')
  })

  it('persiste la duración en Featured Projects, que rota solo', () => {
    const plan = planCommit(proj, ['a'], ['a'], items, 9000)
    expect(plan.payload['proj.settings']).toBe('{"ids":["a"],"duration":9000}')
  })

  it('borra y archiva un concepto no declarado (::c4) presente en items (D6)', () => {
    const withExtraConcept = { ...items, 'proj#a::c4': 'https://cdn/a-c4.webp' }
    const plan = planCommit(proj, ['a', 'b', 'c'], ['b', 'c'], withExtraConcept)
    expect(plan.deleteKeys).toContain('proj#a::c4')
    expect(plan.archiveKeys).toContain('proj#a::c4')
  })

  it('borra un campo no declarado en la spec pero SIN archivarlo (es texto, D6)', () => {
    const withExtraField = { ...items, 'proj#a::theme': 'Cyberpunk' }
    const plan = planCommit(proj, ['a', 'b', 'c'], ['b', 'c'], withExtraField)
    expect(plan.deleteKeys).toContain('proj#a::theme')
    expect(plan.archiveKeys).not.toContain('proj#a::theme')
  })
})

import { planMigration } from '@/lib/cms/collection'

describe('planMigration', () => {
  const proj = COLLECTIONS['proj']
  const hero = COLLECTIONS['hero']

  /* Generador determinista: id0, id1, id2… */
  const makeIds = () => {
    let n = 0
    return () => `id${n++}`
  }

  it('devuelve null si la colección ya tiene ids', () => {
    expect(planMigration(proj, { 'proj.settings': '{"ids":["a"]}' }, makeIds())).toBeNull()
  })

  it('devuelve null si no hay settings ni claves legacy', () => {
    expect(planMigration(proj, {}, makeIds())).toBeNull()
  })

  it('convierte count legacy en ids', () => {
    const plan = planMigration(proj, {
      'proj.settings': '{"count":2}',
      'proj#0': 'https://cdn/a.webp',
      'proj#1': 'https://cdn/b.webp',
    }, makeIds())!
    expect(plan.payload['proj.settings']).toBe('{"ids":["id0","id1"]}')
    expect(plan.payload['proj#id0']).toBe('https://cdn/a.webp')
    expect(plan.payload['proj#id1']).toBe('https://cdn/b.webp')
  })

  it('vacía las claves legacy que quedaron libres', () => {
    const plan = planMigration(proj, {
      'proj.settings': '{"count":1}',
      'proj#0': 'https://cdn/a.webp',
    }, makeIds())!
    expect(plan.payload['proj#0']).toBe('')
  })

  it('arrastra campos y conceptos del item', () => {
    const plan = planMigration(proj, {
      'proj.settings': '{"count":1}',
      'proj#0': 'https://cdn/a.webp',
      'proj#0::title': 'Alpha',
      'proj#0::c1': 'https://cdn/a-c1.webp',
    }, makeIds())!
    expect(plan.payload['proj#id0::title']).toBe('Alpha')
    expect(plan.payload['proj#id0::c1']).toBe('https://cdn/a-c1.webp')
    expect(plan.payload['proj#0::title']).toBe('')
    expect(plan.payload['proj#0::c1']).toBe('')
  })

  it('renames mapea cada clave vieja a la nueva', () => {
    const plan = planMigration(proj, {
      'proj.settings': '{"count":1}',
      'proj#0': 'https://cdn/a.webp',
      'proj#0::title': 'Alpha',
    }, makeIds())!
    expect(plan.renames).toEqual({
      'proj#0': 'proj#id0',
      'proj#0::title': 'proj#id0::title',
    })
  })

  it('migra el infijo .slide de los carruseles y conserva la duración', () => {
    const plan = planMigration(hero, {
      'hero.settings': '{"count":2,"duration":9000}',
      'hero.slide#0': 'https://cdn/s0.webp',
      'hero.slide#1': 'https://cdn/s1.webp',
    }, makeIds())!
    expect(plan.payload['hero.settings']).toBe('{"ids":["id0","id1"],"duration":9000}')
    expect(plan.payload['hero#id0']).toBe('https://cdn/s0.webp')
    expect(plan.payload['hero.slide#0']).toBe('')
  })

  it('descarta los slots legacy vacíos en vez de crear items fantasma', () => {
    const plan = planMigration(proj, {
      'proj.settings': '{"count":3}',
      'proj#0': 'https://cdn/a.webp',
      'proj#1': '',
      'proj#2': 'https://cdn/c.webp',
    }, makeIds())!
    expect(plan.payload['proj.settings']).toBe('{"ids":["id0","id1"]}')
    expect(plan.payload['proj#id0']).toBe('https://cdn/a.webp')
    expect(plan.payload['proj#id1']).toBe('https://cdn/c.webp')
  })

  it('migra claves legacy huérfanas aunque no haya settings', () => {
    const plan = planMigration(proj, {
      'proj#0': 'https://cdn/a.webp',
    }, makeIds())!
    expect(plan.payload['proj.settings']).toBe('{"ids":["id0"]}')
    expect(plan.payload['proj#id0']).toBe('https://cdn/a.webp')
  })

  it('es idempotente: aplicar el plan y replanificar devuelve null', () => {
    const items: Record<string, string> = {
      'proj.settings': '{"count":1}',
      'proj#0': 'https://cdn/a.webp',
    }
    const plan = planMigration(proj, items, makeIds())!
    for (const [k, v] of Object.entries(plan.payload)) {
      if (v === '') delete items[k]
      else items[k] = v
    }
    expect(planMigration(proj, items, makeIds())).toBeNull()
  })

  it('migra un slot legacy sin media pero con campos cargados (D4)', () => {
    const plan = planMigration(proj, {
      'proj.settings': '{"count":1}',
      'proj#0': '',
      'proj#0::title': 'Ficha sin imagen todavía',
    }, makeIds())!
    expect(plan).not.toBeNull()
    expect(plan.payload['proj.settings']).toBe('{"ids":["id0"]}')
    expect(plan.payload['proj#id0::title']).toBe('Ficha sin imagen todavía')
    expect(plan.payload['proj#0::title']).toBe('')
  })

  it('descarta un slot legacy sin media y sin ningún campo (D4)', () => {
    const plan = planMigration(proj, {
      'proj.settings': '{"count":2}',
      'proj#0': '',
      'proj#1': 'https://cdn/b.webp',
    }, makeIds())!
    expect(plan.payload['proj.settings']).toBe('{"ids":["id0"]}')
    expect(plan.payload['proj#id0']).toBe('https://cdn/b.webp')
    expect(plan.payload['proj#0']).toBeUndefined()
  })

  it('un carrusel (sin fields) sigue descartando slots vacíos sin excepción (D4)', () => {
    const plan = planMigration(hero, {
      'hero.settings': '{"count":2}',
      'hero.slide#0': '',
      'hero.slide#1': 'https://cdn/s1.webp',
    }, makeIds())!
    expect(plan.payload['hero.settings']).toBe('{"ids":["id0"]}')
    expect(plan.payload['hero#id0']).toBe('https://cdn/s1.webp')
  })

  it('no confunde indices que comparten prefijo numerico', () => {
    const plan = planMigration(proj, {
      'proj.settings': '{"count":11}',
      'proj#1': 'https://cdn/uno.webp',
      'proj#1::title': 'Uno',
      'proj#10': 'https://cdn/diez.webp',
      'proj#10::title': 'Diez',
    }, makeIds())!
    expect(plan.payload['proj.settings']).toBe('{"ids":["id0","id1"]}')
    expect(plan.payload['proj#id0']).toBe('https://cdn/uno.webp')
    expect(plan.payload['proj#id0::title']).toBe('Uno')
    expect(plan.payload['proj#id1']).toBe('https://cdn/diez.webp')
    expect(plan.payload['proj#id1::title']).toBe('Diez')
    expect(plan.renames).toEqual({
      'proj#1': 'proj#id0',
      'proj#1::title': 'proj#id0::title',
      'proj#10': 'proj#id1',
      'proj#10::title': 'proj#id1::title',
    })
  })
})

import { migrationId, migrationIdGenerator } from '@/lib/cms/collection'

describe('migrationId / migrationIdGenerator (D2)', () => {
  it('es determinista: el mismo seed produce siempre el mismo id', () => {
    expect(migrationId('proj#0')).toBe(migrationId('proj#0'))
    expect(migrationId('char#3')).toBe(migrationId('char#3'))
  })

  it('dos corridas independientes del generador producen exactamente los mismos ids', () => {
    const genA = migrationIdGenerator('proj')
    const idsA = [genA([]), genA([]), genA([])]
    const genB = migrationIdGenerator('proj')
    const idsB = [genB([]), genB([]), genB([])]
    expect(idsA).toEqual(idsB)
  })

  it('siempre contiene al menos una letra, para cualquier seed', () => {
    for (let i = 0; i < 200; i++) {
      const id = migrationId(`proj#${i}`)
      expect(id).toMatch(/[a-z]/)
    }
  })

  it('resuelve colisiones dentro de la misma corrida de forma también determinista', () => {
    const id1 = migrationId('seed-x')
    const id2 = migrationId('seed-x', [id1])
    expect(id2).not.toBe(id1)
    expect(migrationId('seed-x', [id1])).toBe(id2)
  })
})

import { FIXED_SLOTS, fixedSlotKeys } from '@/lib/cms/collections'

describe('FIXED_SLOTS', () => {
  it('declara los slots de tamaño fijo con su longitud', () => {
    const byBase = Object.fromEntries(FIXED_SLOTS.map((s) => [s.base, s.length]))
    expect(byBase['illustration']).toBe(15)
    expect(byBase['model3d']).toBe(6)
    expect(byBase['model3d.gallery']).toBe(12)
    expect(byBase['hero.marquee']).toBe(11)
    expect(byBase['anim']).toBe(6)
  })

  it('no declara ninguna colección dinámica', () => {
    const bases = FIXED_SLOTS.map((s) => s.base)
    for (const prefix of Object.keys(COLLECTIONS)) {
      expect(bases).not.toContain(prefix)
    }
  })

  it('fixedSlotKeys expande cada base a sus claves posicionales', () => {
    const keys = fixedSlotKeys()
    expect(keys).toContain('illustration#0')
    expect(keys).toContain('illustration#14')
    expect(keys).not.toContain('illustration#15')
    expect(keys).not.toContain('proj#0')
  })
})
