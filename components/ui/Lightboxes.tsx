'use client'

/* Lightboxes de imagen/video — markup portado de shared-ui.js (LIGHTBOXES),
   handlers portados de script.js (close/toggle/click-fondo). La apertura
   la hacen los consumidores vía openLightbox/openVideoLightbox (lightbox.ts). */

import { closeLightbox, closeVideoLightbox, handleLightboxClick, toggleLightboxInfo } from './lightbox'

function InfoPanel({ withLink }: { withLink?: boolean }) {
  return (
    <div className="lightbox-info-panel hidden">
      <h3 className="info-title"></h3>
      <div className="info-divider"></div>
      <div className="info-meta">
        <span className="info-date hidden"><i className="fa-regular fa-calendar"></i> <span className="val"></span></span>
        <span className="info-project hidden"><i className="fa-solid fa-folder-open"></i> <span className="val"></span></span>
      </div>
      <p className="info-desc"></p>
      <p className="info-inspiration hidden"><i className="fa-solid fa-wand-magic-sparkles"></i> <b>Inspiration:</b> <span className="val"></span></p>
      {/* Hueco vacío, no un <a> sin href. Un ancla sin href no es un enlace y
          los rastreadores la reportan como enlace muerto (fallaba
          `crawlable-anchors`); esconderla con display:none no la saca del
          markup. El ancla la crea lightbox.ts solo cuando hay URL real.
          `display: contents` deja al ancla en el flujo del panel como si
          fuera hija directa, así el CSS de .info-link no cambia. */}
      {withLink && <span className="info-link-slot" style={{ display: 'contents' }} />}
      <div className="info-footer">
        <span><i className="fa-solid fa-palette"></i> Lucia Montaña</span>
      </div>
    </div>
  )
}

export default function Lightboxes() {
  return (
    <>
      <div id="image-lightbox" className="lightbox" onClick={(e) => handleLightboxClick(e, 'image')}>
        <span className="lightbox-close" onClick={closeLightbox}>&times;</span>
        <div className="lightbox-wrapper">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img id="lightbox-img" className="lightbox-content" alt="" />
          <button className="info-toggle-btn" onClick={toggleLightboxInfo}><i className="fa-solid fa-circle-info"></i></button>
          <InfoPanel withLink />
        </div>
      </div>
      <div id="video-lightbox" className="lightbox" onClick={(e) => handleLightboxClick(e, 'video')}>
        <span className="lightbox-close" onClick={closeVideoLightbox}>&times;</span>
        <div className="lightbox-wrapper">
          <video id="lightbox-video" className="lightbox-content" controls loop></video>
          <button className="info-toggle-btn" onClick={toggleLightboxInfo}><i className="fa-solid fa-circle-info"></i></button>
          <InfoPanel />
        </div>
      </div>
    </>
  )
}
