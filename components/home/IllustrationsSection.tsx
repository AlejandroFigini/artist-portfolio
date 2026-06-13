/* Illustrations (home) — galería circular 3D (CircularGallery). Mientras
   no hay contenido, se montan contenedores placeholder blueprint; cada
   uno se reemplazará luego por una ilustración (vía CMS/backend). Canvas
   nebula vivo de fondo conservado. */

import NebulaCanvas from './NebulaCanvas'
import { CircularGallery, GalleryItem } from '@/components/ui/circular-gallery'
import './illustrations-gallery.css'

// Contenedores vacíos: photo.url vacío → CircularGallery pinta placeholder
// blueprint. Reemplazar `common`/`binomial`/`photo` por contenido real luego.
const PLACEHOLDERS: GalleryItem[] = Array.from({ length: 8 }, (_, i) => ({
  common: `Slot ${String(i + 1).padStart(2, '0')}`,
  binomial: 'Pendiente de contenido',
  photo: { url: '', text: '', by: '' },
}))

export default function IllustrationsSection() {
  return (
    <section id="ilustraciones" className="gallery-section">
      <div className="gallery-bg-animation">
        <div className="blob-1"></div>
        <div className="blob-2"></div>
        <div className="blob-3"></div>

        <div className="aurora-container">
          <div className="aurora a1"></div>
          <div className="aurora a2"></div>
          <div className="aurora a3"></div>
        </div>

        <NebulaCanvas />
      </div>
      <div className="section-title" data-scroll="reveal">
        <h2 className="section-typewriter" data-i18n="illustrations_title">Illustrations</h2>
        {/* regla-cota: se llena con el avance de la sección (HomeFx scrub) */}
        <span className="title-rule" aria-hidden="true"><span className="title-rule-fill"></span></span>
        <p>Complete gallery and conceptual works.</p>
        <a className="see-all-cta" href="/illustrations"><span>Explore all illustrations</span> <i className="fa-solid fa-arrow-right"></i></a>
      </div>

      {/* Galería circular 3D: auto-rota e ítems giran con el scroll */}
      <div className="illu-stage">
        <CircularGallery items={PLACEHOLDERS} radius={520} />
      </div>
    </section>
  )
}
