import { useEffect, useState } from 'react';
import { useMotionReady, prefersReducedMotion } from '@/hooks/useGSAP';
import { useCmsStore, state } from '@/lib/cms/store';
import { useCmsItems } from '@/lib/cms/content-context';
import { useCarouselSync } from '@/components/ui/useCarouselSync';
import { COLLECTIONS } from '@/lib/cms/collections';
import { itemKey } from '@/lib/cms/collection';
import { readSettings } from '@/lib/cms/collection';
import { DEFAULT_DURATION_MS } from '@/lib/cms/useCollection';
import { markLoaderGate, type LoaderGate } from '@/lib/loader-ready';

import { mediaSrcSet, optimizedMediaSrc } from '@/lib/utils';

/* `eager` solo para la primera slide del carrusel que reporta el gate del
   loader: esa es la imagen del LCP. El resto va en `lazy` — ahora que las
   slides se pintan en el servidor, sin esto el carrusel de About (que está
   debajo del fold) bajaba sus cuatro imágenes en la carga inicial. Las que
   están dentro del viewport las trae el navegador igual aunque sean `lazy`. */
function SmoothImage({ src, className, onSettled, eager }: { src: string; className?: string; onSettled?: () => void; eager?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={optimizedMediaSrc(src, 1200)}
      srcSet={mediaSrcSet(src)}
      // el panel ocupa ~la mitad del ancho en desktop y casi todo en móvil
      sizes="(max-width: 768px) 90vw, 50vw"
      alt=""
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      decoding="async"
      onLoad={() => { setLoaded(true); onSettled?.(); }}
      onError={() => onSettled?.()}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        opacity: loaded ? 1 : 0,
        transition: 'opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    />
  );
}

type Props = {
  prefix: string;
  className?: string;
  label?: string;
  /* Gate de la pantalla de carga que reporta este carrusel. Solo lo pasa el
     carrusel principal del hero: es la única imagen crítica above the fold. */
  readyGate?: LoaderGate;
};

export default function HeroMediaCarousel({
  prefix,
  className = 'cms-media',
  label = 'Home carousel',
  readyGate,
}: Props) {
  const motion = useMotionReady() // GSAP llega en su propio chunk;
  useCmsStore();
  const serverReady = state.serverReady;

  const spec = COLLECTIONS[prefix];
  /* `useCmsItems` en vez de `state.items`: en el render del servidor el store
     está vacío y este carrusel emitía su estado vacío, con lo cual la imagen
     principal de la portada —el LCP— no existía en el HTML y no empezaba a
     bajar hasta después de hidratar. Leyendo del contexto, el <img> con su
     `src` real sale ya en el marcado del servidor. */
  const items = useCmsItems();
  const settings = readSettings(items, prefix);
  const slides = settings.ids.map((id) => items[itemKey(spec, id)] || '');
  const duration = settings.duration ?? DEFAULT_DURATION_MS;
  const finalPanels = slides;

  // Signature for sync hook – concatenated slide sources
  const slidesKey = finalPanels.join('|');

  // Sync with admin changes via shared hook (reInit & optional rescan)
  useCarouselSync(undefined, slidesKey);

  // Slot vacío → no hay imagen que esperar, pero recién se sabe con el
  // contenido del servidor ya mergeado.
  const firstSrc = (finalPanels[0] || '').trim();
  useEffect(() => {
    if (readyGate && serverReady && !firstSrc) markLoaderGate(readyGate);
  }, [readyGate, serverReady, firstSrc]);

  // Effect to drive cross‑fade animation when slides are present
  useEffect(() => {
    if (!motion) return;
    const { gsap } = motion;
    const els = document.querySelectorAll<HTMLElement>(`.${prefix}-carousel-slide`);
    if (els.length === 0) return;
    gsap.set(els, { opacity: 0 });
    /* Con menos movimiento pedido: primera slide fija, sin fundido de entrada
       ni rotación. Mismo criterio que Slideshow.tsx. */
    if (prefersReducedMotion()) { gsap.set(els[0], { opacity: 1 }); return; }
    gsap.fromTo(els[0], { opacity: 0 }, { opacity: 1, duration: 2.0, ease: 'power2.out' });
    if (els.length < 2) return;
    let current = 0;
    const tick = () => {
      if (document.body.classList.contains('contact-modal-open') || document.body.classList.contains('cms-modal-open')) {
        return;
      }
      const next = (current + 1) % els.length;
      try {
        gsap.fromTo(
          els[next],
          { opacity: 0 },
          { opacity: 1, duration: 2.0, ease: 'power1.inOut' },
        );
        gsap.to(els[current], { opacity: 0, duration: 2.0, ease: 'power1.inOut' });
        current = next;
      } catch (err) {
        console.error(`[HeroMediaCarousel] GSAP error:`, err);
      }
    };
    /* El crossfade solo existe mientras alguien lo mira. Antes el temporizador
       corría toda la sesión: tres instancias montadas (hero principal, hero
       secundario y el carrusel de About) tejiendo dos tweens de 2s cada ciclo
       con el hero ya a miles de píxeles del viewport. No alcanza con un
       early-return: un `setInterval` que despierta para no hacer nada igual
       despierta la CPU, y en móvil ese wake-up cae en medio del scroll. */
    let timer: ReturnType<typeof setInterval> | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!timer) timer = setInterval(tick, duration);
        } else if (timer) {
          clearInterval(timer);
          timer = undefined;
        }
      },
      { rootMargin: '10% 0px' },
    );
    io.observe(els[0]);
    return () => {
      if (timer) clearInterval(timer);
      io.disconnect();
      gsap.killTweensOf(els);
    };
    // slidesKey changes when images are added/removed → re‑arm crossfade.
  }, [motion, slidesKey, duration, prefix]);

  return (
    <>
      {finalPanels.length > 0 ? (
        finalPanels.map((src, i) => {
          const isFilled = !!(src && src.trim() !== '');
          return (
            <div
              key={`${i}-${src || 'empty'}`}
              className={`${prefix}-carousel-slide hero-slide-panel`}
              style={{ position: 'absolute', inset: 0, opacity: 0, zIndex: i === 0 ? 1 : 0 }}
            >
              {isFilled ? (
                <SmoothImage
                  src={src}
                  className={className}
                  eager={!!readyGate && i === 0}
                  onSettled={readyGate && i === 0 ? () => markLoaderGate(readyGate) : undefined}
                />
              ) : (
                <div className="hero-carousel-empty" aria-hidden="true">
                  <i className="fa-solid fa-cloud-arrow-up" />
                  <span>{label}</span>
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div
          className={`${prefix}-carousel-slide hero-slide-panel`}
          style={{ position: 'absolute', inset: 0, opacity: 1, zIndex: 1 }}
        >
          <div className="hero-carousel-empty" aria-hidden="true">
            <i className="fa-solid fa-cloud-arrow-up" />
            <span>{label}</span>
          </div>
        </div>
      )}
    </>
  );
}
