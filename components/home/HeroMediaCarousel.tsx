// 'use client'

import { useEffect, useReducer } from 'react';
import { ensureGSAP, gsap, prefersReducedMotion } from '@/hooks/useGSAP';
import { useCmsStore, state } from '@/lib/cms/store';
import { useCarouselSync } from '@/components/ui/useCarouselSync';

// Default duration if not provided by CMS
const DEFAULT_DURATION_MS = 7000;

function readCarousel(prefix: string): { slides: string[]; duration: number } {
  let count = 0;
  let duration = DEFAULT_DURATION_MS;
  try {
    const s = JSON.parse(state.items[`${prefix}.settings`] || '');
    if (s && typeof s.count === 'number') count = s.count;
    if (s && typeof s.duration === 'number') duration = s.duration;
  } catch {}
  const slides: string[] = [];
  const n = Number.isFinite(count) ? Math.max(0, count) : 0;
  for (let i = 0; i < n; i++) slides.push(state.items[`${prefix}.slide#${i}`] || '');
  return { slides, duration };
}

type Props = {
  prefix: string;
  defaultSlides?: string[]; // kept for backward compatibility, not used for empty state
  className?: string;
  label?: string;
};

export default function HeroMediaCarousel({
  prefix,
  defaultSlides = [],
  className = 'cms-media',
  label = 'Carrusel de portada',
}: Props) {
  // ensure component re‑renders when CMS store updates (hydration, admin edits, etc.)
  useCmsStore();
  const [, force] = useReducer((x: number) => x + 1, 0);

  // Read slides & duration directly from CMS state
  const { slides, duration } = readCarousel(prefix);

  // No default fallback – if slides array is empty we render nothing (fully empty carousel)
  const finalPanels = slides;

  // Signature for sync hook – concatenated slide sources
  const slidesKey = finalPanels.join('|');

  // Sync with admin changes via shared hook (reInit & optional rescan)
  useCarouselSync(undefined, slidesKey);

  // Effect to drive cross‑fade animation when slides are present
  useEffect(() => {
    const onCarousel = () => force();
    ensureGSAP();
    const els = document.querySelectorAll<HTMLElement>(`.${prefix}-carousel-slide`);
    console.log(`[HeroMediaCarousel] prefix=${prefix} re-render. slidesKey=${slidesKey}, els.length=${els.length}`);
    if (els.length === 0) return;
    gsap.set(els, { opacity: 0 });
    gsap.set(els[0], { opacity: 1 });
    if (els.length < 2) return;
    let current = 0;
    const timer = setInterval(() => {
      const next = (current + 1) % els.length;
      console.log(`[HeroMediaCarousel] ${prefix} crossfade from ${current} to ${next}`);
      try {
        gsap.fromTo(
          els[next],
          { opacity: 0 },
          { opacity: 1, duration: 1.6, ease: 'power1.inOut' },
        );
        gsap.to(els[current], { opacity: 0, duration: 1.6, ease: 'power1.inOut' });
        current = next;
      } catch (err) {
        console.error(`[HeroMediaCarousel] GSAP error:`, err);
      }
    }, duration);
    return () => {
      console.log(`[HeroMediaCarousel] ${prefix} cleanup`);
      clearInterval(timer);
      gsap.killTweensOf(els);
    };
    // slidesKey changes when images are added/removed → re‑arm crossfade.
  }, [slidesKey, duration, prefix]);

  return (
    <>
      {finalPanels.length > 0 ? (
        finalPanels.map((src, i) => {
          const isFilled = !!(src && src.trim() !== '');
          return (
            <div
              key={`${i}-${src || 'empty'}`}
              className={`${prefix}-carousel-slide hero-slide-panel`}
              style={{ position: 'absolute', inset: 0, opacity: i === 0 ? 1 : 0, zIndex: i === 0 ? 1 : 0 }}
            >
              {isFilled ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt=""
                  className={className}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
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
