'use client'

/* Lightboxes de imagen/video — markup portado de shared-ui.js (LIGHTBOXES),
   handlers portados de script.js (close/toggle/click-fondo). La apertura
   la hacen los consumidores vía openLightbox/openVideoLightbox (lightbox.ts). */

import LightboxInfoPanel from './LightboxInfoPanel'
import { useUiText } from '@/lib/cms/store'
import VideoPlayer from './VideoPlayer'
import { closeLightbox, closeVideoLightbox, handleLightboxClick, toggleLightboxInfo } from './lightbox'

export default function Lightboxes() {
  const ui = useUiText()
  return (
    <>
      <div id="image-lightbox" className="lightbox" onClick={(e) => handleLightboxClick(e, 'image')}>
        <span className="lightbox-close" onClick={closeLightbox}>&times;</span>
        <div className="lightbox-wrapper">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img id="lightbox-img" className="lightbox-content" alt="" />
          <button className="info-toggle-btn" onClick={toggleLightboxInfo}><i className="fa-solid fa-circle-info"></i></button>
          <LightboxInfoPanel className="hidden" imperative linkSlot />
        </div>
      </div>
      <div id="video-lightbox" className="lightbox" onClick={(e) => handleLightboxClick(e, 'video')}>
        <span className="lightbox-close" onClick={closeVideoLightbox}>&times;</span>
        <div className="lightbox-wrapper">
          {/* Controles propios: lightbox.ts sigue manejando este <video> por su id. */}
          <VideoPlayer
            videoId="lightbox-video"
            className="lightbox-content"
            loop
            labels={{ play: ui('play'), pause: ui('pause'), seek: ui('seek') }}
          />
          <button className="info-toggle-btn" onClick={toggleLightboxInfo}><i className="fa-solid fa-circle-info"></i></button>
          <LightboxInfoPanel className="hidden" imperative />
        </div>
      </div>
    </>
  )
}
