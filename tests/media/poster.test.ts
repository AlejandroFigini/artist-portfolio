import { describe, it, expect } from 'vitest'
import { isVideoSrc, videoPosterSrc } from '@/lib/utils'
import { acceptsMediaKind, resolveMediaKind } from '@/components/cms/engine'
import { storeHref } from '@/components/home/GameDevShowcase'

describe('videoPosterSrc', () => {
  it('deriva el primer frame de un video de Cloudinary', () => {
    expect(videoPosterSrc('https://res.cloudinary.com/demo/video/upload/v1690000000/portfolio/gallop_a1b2c3.webm'))
      .toBe('https://res.cloudinary.com/demo/video/upload/f_auto,q_auto,w_640,c_limit,so_0/v1690000000/portfolio/gallop_a1b2c3.jpg')
  })
  it('ignora query/hash', () => {
    expect(videoPosterSrc('https://res.cloudinary.com/demo/video/upload/v1/a.mp4?_r=2'))
      .toBe('https://res.cloudinary.com/demo/video/upload/f_auto,q_auto,w_640,c_limit,so_0/v1/a.jpg')
  })
  it('sin extensión igual devuelve .jpg', () => {
    expect(videoPosterSrc('https://res.cloudinary.com/demo/video/upload/v1/a'))
      .toBe('https://res.cloudinary.com/demo/video/upload/f_auto,q_auto,w_640,c_limit,so_0/v1/a.jpg')
  })
  it('no toca imágenes ni rutas locales', () => {
    expect(videoPosterSrc('https://res.cloudinary.com/demo/image/upload/v1/a.webp')).toBe('')
    expect(videoPosterSrc('/uploads/reel_ab12.webm')).toBe('')
    expect(videoPosterSrc('')).toBe('')
  })
})

/* Contenedores `media` (Game Dev): el tipo lo decide la URL guardada, porque
   el contenedor acepta imagen y animación y el registro no lo distingue. */
describe('isVideoSrc', () => {
  it('reconoce las extensiones de video', () => {
    expect(isVideoSrc('/uploads/reel.webm')).toBe(true)
    expect(isVideoSrc('/uploads/clip.mp4')).toBe(true)
    expect(isVideoSrc('https://res.cloudinary.com/demo/video/upload/v1/a.mov')).toBe(true)
    expect(isVideoSrc('/uploads/a.m4v?_r=2')).toBe(true)
  })
  it('no confunde imágenes ni vacíos', () => {
    expect(isVideoSrc('/uploads/art.webp')).toBe(false)
    expect(isVideoSrc('/uploads/webm-render.png')).toBe(false)
    expect(isVideoSrc('')).toBe(false)
    expect(isVideoSrc(null)).toBe(false)
  })
})

describe('resolveMediaKind', () => {
  it('respeta el tipo declarado cuando el registro lo fija', () => {
    expect(resolveMediaKind('video', '/uploads/art.webp')).toBe('video')
    expect(resolveMediaKind('image', '/uploads/reel.webm')).toBe('image')
  })
  it('en `media` lo decide el archivo', () => {
    expect(resolveMediaKind('media', '/uploads/reel.webm')).toBe('video')
    expect(resolveMediaKind('media', '/uploads/art.webp')).toBe('image')
    expect(resolveMediaKind('media', '')).toBe('image')
  })
})

/* Enlace a tienda del proyecto destacado (Game Dev). Se resuelve SIN base para
   que servidor y cliente produzcan el mismo href — con base, un texto suelto
   se volvía un enlace al propio sitio y rompía la hidratación. */
describe('storeHref', () => {
  it('acepta URLs absolutas http(s)', () => {
    expect(storeHref('https://store.steampowered.com/app/123/')).toBe('https://store.steampowered.com/app/123/')
    expect(storeHref('http://itch.io/x')).toBe('http://itch.io/x')
  })
  it('completa el esquema cuando el valor tiene forma de host', () => {
    expect(storeHref('store.steampowered.com/app/123')).toBe('https://store.steampowered.com/app/123')
    expect(storeHref('  itch.io  ')).toBe('https://itch.io/')
  })
  it('descarta texto suelto en vez de convertirlo en enlace al sitio', () => {
    expect(storeHref('asdadsaddsad')).toBe('')
    expect(storeHref('/uploads/a.webp')).toBe('')
    expect(storeHref('')).toBe('')
  })
  it('descarta esquemas ejecutables', () => {
    expect(storeHref('javascript:alert(1)')).toBe('')
    expect(storeHref('data:text/html,<script>')).toBe('')
  })
})

/* Compatibilidad archivo ↔ contenedor. El bug: en un contenedor `media` la
   comparación cruda marcaba TODO el video como incompatible, y como en ese
   caso la grilla no se ordena por compatibilidad, la cabecera "Incompatible
   content" se repetía en cada tramo de la lista. */
describe('acceptsMediaKind', () => {
  it('un contenedor `media` acepta las dos cosas', () => {
    expect(acceptsMediaKind('media', 'video')).toBe(true)
    expect(acceptsMediaKind('media', 'image')).toBe(true)
    expect(acceptsMediaKind('media', undefined)).toBe(true)
  })
  it('un contenedor de video solo acepta video', () => {
    expect(acceptsMediaKind('video', 'video')).toBe(true)
    expect(acceptsMediaKind('video', 'image')).toBe(false)
  })
  it('un contenedor de imagen solo acepta imagen', () => {
    expect(acceptsMediaKind('image', 'image')).toBe(true)
    expect(acceptsMediaKind('image', 'video')).toBe(false)
  })
  it('sin tipo de archivo se trata como imagen', () => {
    expect(acceptsMediaKind('image', undefined)).toBe(true)
    expect(acceptsMediaKind('video', undefined)).toBe(false)
  })
})

describe('storeHref — valores pegados de más', () => {
  it('se queda con el primer token: una URL no lleva espacios', () => {
    expect(storeHref('https://store.steampowered.com/app/1/ store.steampowered.com/app/1/'))
      .toBe('https://store.steampowered.com/app/1/')
    expect(storeHref('store.steampowered.com/app/1/  nota suelta'))
      .toBe('https://store.steampowered.com/app/1/')
  })
})
