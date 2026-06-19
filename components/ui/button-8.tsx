'use client'

/* Sparkle CV button — adaptado a @tsparticles/react v4 (useParticlesProvider,
   no initParticlesEngine). El ParticlesProvider global vive en Providers.tsx
   con loadFull. Estrellas emiten en hover. */

import { useMemo, useState } from "react";
import { Sparkle } from "lucide-react";
import type { ISourceOptions } from "@tsparticles/engine";
import Particles, { useParticlesProvider } from "@tsparticles/react";
import { cn } from "@/lib/utils";

const options: ISourceOptions = {
  key: "star",
  name: "Star",
  particles: {
    number: { value: 20, density: { enable: false } },
    color: {
      value: ["#7c3aed", "#bae6fd", "#a78bfa", "#93c5fd", "#0284c7", "#fafafa", "#38bdf8"],
    },
    shape: { type: "star", options: { star: { sides: 4 } } },
    opacity: { value: 0.8 },
    size: { value: { min: 1, max: 4 } },
    rotate: {
      value: { min: 0, max: 360 },
      enable: true,
      direction: "clockwise",
      animation: { enable: true, speed: 10, sync: false },
    },
    links: { enable: false },
    reduceDuplicates: true,
    move: { enable: true, center: { x: 46, y: 27 } },
  },
  interactivity: { events: {} },
  smooth: true,
  fpsLimit: 120,
  background: { color: "transparent", size: "cover" },
  fullScreen: { enable: false },
  detectRetina: true,
  absorbers: [
    {
      enable: true,
      opacity: 0,
      size: { value: 1, density: 1, limit: { radius: 5, mass: 5 } },
      position: { x: 46, y: 27 },
    },
  ],
  emitters: [
    {
      autoPlay: true,
      fill: true,
      life: { wait: true },
      rate: { quantity: 5, delay: 0.5 },
      position: { x: 46, y: 27 },
    },
  ],
};

function Stars({ isHovering }: { isHovering: boolean }) {
  const { loaded } = useParticlesProvider();
  const modifiedOptions = useMemo(() => {
    options.autoPlay = isHovering;
    return options;
  }, [isHovering]);

  if (!loaded) return null;

  return (
    <Particles
      id="cv-stars"
      className={cn(
        "pointer-events-none absolute -bottom-4 -left-4 -right-4 -top-4 z-0 opacity-0 transition-opacity",
        { "group-hover:opacity-100": isHovering || true },
      )}
      options={modifiedOptions}
    />
  );
}

type CvButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
};

export const CvButton = ({ label = "CV", className, ...props }: CvButtonProps) => {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <button
      className={cn(
        "group relative flex items-center justify-center rounded-full border-0 bg-gradient-to-r from-blue-300 via-blue-500 via-40% to-purple-500 text-white outline-none transition-transform hover:scale-105 active:scale-100",
        className,
      )}
      style={{ gap: '0.4rem', padding: '0.4rem 1rem', fontSize: '0.85rem' }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      {...props}
    >
      <Sparkle className="size-4 -translate-y-0.5 animate-sparkle fill-white" />
      <Sparkle
        style={{ animationDelay: "1s" }}
        className="absolute bottom-2 left-3 z-20 size-2 rotate-12 animate-sparkle fill-white"
      />
      <Sparkle
        style={{ animationDelay: "1.5s", animationDuration: "2.5s" }}
        className="absolute left-5 top-2 size-1 -rotate-12 animate-sparkle fill-white"
      />
      <Sparkle
        style={{ animationDelay: "0.5s", animationDuration: "2.5s" }}
        className="absolute left-3.5 top-2.5 size-1.5 animate-sparkle fill-white"
      />
      <span style={{ fontWeight: 600 }}>{label}</span>
      <Stars isHovering={isHovering} />
    </button>
  );
};

export { CvButton as Component };
