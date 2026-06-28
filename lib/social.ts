/* Lista única de redes sociales del sitio. Fuente de verdad para los iconos
   de Nav, Footer y cualquier sección que redirija a redes. Las URLs se editan
   en Gestión y se guardan en cms_data con la clave `social.<id>`. */

export type SocialNetwork = {
  id: string
  label: string
  icon: string // clase FontAwesome (sin el prefijo fa-brands/fa-solid)
  brand: boolean // true → fa-brands, false → fa-solid
  type?: 'url' | 'email'
  placeholder: string
}

export const SOCIAL_NETWORKS: SocialNetwork[] = [
  { id: 'artstation', label: 'Artstation', icon: 'fa-artstation', brand: true, placeholder: 'https://www.artstation.com/usuario' },
  { id: 'vimeo', label: 'Vimeo', icon: 'fa-vimeo-v', brand: true, placeholder: 'https://vimeo.com/usuario' },
  { id: 'youtube', label: 'Youtube', icon: 'fa-youtube', brand: true, placeholder: 'https://youtube.com/@usuario' },
  { id: 'instagram', label: 'Instagram', icon: 'fa-instagram', brand: true, placeholder: 'https://instagram.com/usuario' },
  { id: 'behance', label: 'Behance', icon: 'fa-behance', brand: true, placeholder: 'https://www.behance.net/usuario' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'fa-linkedin-in', brand: true, placeholder: 'https://www.linkedin.com/in/usuario' },
  { id: 'email', label: 'Email', icon: 'fa-envelope', brand: false, type: 'email', placeholder: 'tucorreo@dominio.com' },
]

export const socialKey = (id: string) => `social.${id}`

/** href final según el tipo de red (mailto: para email). Vacío → sin enlace. */
export function socialHref(net: SocialNetwork, value: string): string {
  const v = (value || '').trim()
  if (!v) return ''
  if (net.type === 'email') return v.startsWith('mailto:') ? v : `mailto:${v}`
  return v
}
