'use client'

/* Panel de info de la vista en pantalla completa. Único para los tres
   consumidores: el lightbox global (Lightboxes.tsx, que escribe los valores
   imperativamente desde lightbox.ts) y los lightbox propios de Animations y
   Characters, que pasan los valores por props.

   Orden: metadatos cortos (fecha / proyecto / rol) en UN renglón, con el icono
   haciendo de etiqueta; después la inspiración, que sí lleva su texto; y última
   la descripción, en su propio bloque con título, porque es el campo largo. */

import { useUiText } from '@/lib/cms/store'

type Props = {
  className?: string
  /* Modo imperativo: los `.val` van vacíos y las filas opcionales arrancan
     ocultas; lightbox.ts las llena y les saca `hidden`. */
  imperative?: boolean
  title?: string
  date?: string
  project?: string
  role?: string
  desc?: string
  inspiration?: string
  /* Hueco para el ancla "View original post": la crea lightbox.ts solo si hay
     URL real (un <a> sin href se reporta como enlace muerto). */
  linkSlot?: boolean
  onClick?: (e: React.MouseEvent) => void
}

/* Dato corto del renglón de metadatos: solo icono + valor. El nombre del campo
   viaja en un `.sr-only` para que el lector de pantalla no pierda el contexto. */
function MetaItem({ name, icon, label, value, imperative }: {
  name: string; icon: string; label: string; value?: string; imperative?: boolean
}) {
  if (!imperative && !value) return null
  return (
    <span className={`lb-meta__item lb-${name}${imperative && !value ? ' hidden' : ''}`}>
      <i className={icon} aria-hidden="true"></i>
      <span className="sr-only">{label}</span>
      <span className="val">{value}</span>
    </span>
  )
}

export default function LightboxInfoPanel({
  className = '', imperative, title, date, project, role, desc, inspiration, linkSlot, onClick,
}: Props) {
  const ui = useUiText()
  return (
    <div className={`lightbox-info-panel ${className}`.trim()} onClick={onClick} data-lenis-prevent>
      <h3 className="info-title">{title}</h3>
      <div className="info-divider"></div>

      <div className="lb-meta">
        <MetaItem name="date" icon="fa-regular fa-calendar" label={ui('field_date')} value={date} imperative={imperative} />
        <MetaItem name="project" icon="fa-solid fa-folder-open" label={ui('field_project')} value={project} imperative={imperative} />
        <MetaItem name="role" icon="fa-solid fa-masks-theater" label={ui('field_role')} value={role} />
      </div>

      {(imperative || inspiration) && (
        <p className={`lb-inspiration${imperative && !inspiration ? ' hidden' : ''}`}>
          <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
          <span className="lb-inline-label">{ui('inspiration')}:</span>
          <span className="val">{inspiration}</span>
        </p>
      )}

      {(imperative || desc) && (
        <div className={`lb-desc${imperative && !desc ? ' hidden' : ''}`}>
          <h4 className="lb-desc__label">{ui('field_description')}</h4>
          <p className="val">{desc}</p>
        </div>
      )}

      {linkSlot && <span className="info-link-slot" style={{ display: 'contents' }} />}
    </div>
  )
}
