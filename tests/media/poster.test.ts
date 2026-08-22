import { describe, it, expect } from 'vitest'
import { videoPosterSrc } from '@/lib/utils'

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
