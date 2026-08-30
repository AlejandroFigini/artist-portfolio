'use client'

/* Ficha al hover sobre una pieza de media — degradado desde abajo, título en
   Syne y meta en mono con iconos. Es la misma lectura que ya tenían las
   tarjetas de Animations e Illustrations; acá está extraída porque a partir de
   Game Dev y 3D pasaba a ser la cuarta copia del mismo bloque.

   Se resuelve con `t()` (lib/cms/content-context) en quien la usa y no leyendo
   los `data-*` del DOM: así sale ya en el HTML del servidor y sigue el idioma
   activo sin depender de que el motor mute el DOM.

   No pinta nada sin datos: un contenedor sin ficha no se tapa con un degradado
   vacío. La visibilidad al hover la controla el CSS de cada sección
   (styles/media-caption.css), que también la esconde en el contenedor vacío —
   ahí manda el marco punteado. */

export default function MediaCaption({
  title,
  date,
  project,
}: {
  title?: string
  date?: string
  project?: string
}) {
  if (!title && !date && !project) return null

  return (
    <figcaption className="media-caption">
      {title && <span className="media-caption__title">{title}</span>}
      {(project || date) && (
        <span className="media-caption__meta">
          {project && (
            <span className="media-caption__project">
              <i className="fa-solid fa-folder" aria-hidden="true" /> <span className="val">{project}</span>
            </span>
          )}
          {date && (
            <span className="media-caption__date">
              <i className="fa-regular fa-calendar" aria-hidden="true" /> <span className="val">{date}</span>
            </span>
          )}
        </span>
      )}
    </figcaption>
  )
}
