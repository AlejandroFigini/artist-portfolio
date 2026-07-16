import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Multimedia | Lucía Montaña',
  description: 'Multimedia and experimental mixed media projects by Lucía Montaña.',
}

function Corners() {
  return (
    <>
      <span className="bp-corner tl" />
      <span className="bp-corner tr" />
      <span className="bp-corner bl" />
      <span className="bp-corner br" />
    </>
  )
}

export default function MultimediaPage() {
  return (
    <main className="pt-24 pb-16 min-h-[85vh] flex items-center justify-center relative overflow-hidden" style={{ background: 'var(--bg-main)' }}>
      {/* Blueprint grid background */}
      <div 
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage: `
            linear-gradient(rgba(124, 58, 237, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124, 58, 237, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: '30px 30px',
        }}
      />
      
      {/* Center crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 pointer-events-none opacity-40">
        <span className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-cyan-400" />
        <span className="absolute left-0 right-0 top-1/2 h-[1px] bg-cyan-400" />
      </div>

      <div className="relative p-12 max-w-xl mx-auto border border-dashed border-[var(--accent)] rounded-2xl bg-[rgba(124,58,237,0.03)] backdrop-blur-md text-center">
        <Corners />
        <div className="text-[0.7rem] font-mono text-cyan-400 tracking-[0.25em] uppercase mb-4 opacity-80">{"// FILE 07 · SYSTEM OFFLINE"}</div>
        <h1 className="text-3xl font-bold tracking-wide mb-3 text-white" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>Multimedia & Mixed Media</h1>
        <p className="text-sm font-mono text-gray-400 leading-relaxed mb-6">
          Everything that doesn&apos;t fit a single box: interactive web shaders, experimental video loops, and generative design feeds. Currently undergoing synchronization.
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-cyan-500/30 rounded-md font-mono text-[0.75rem] text-cyan-400 bg-cyan-950/20">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>STATUS: CONSTRUCTING VIEWPORT</span>
        </div>
      </div>
    </main>
  )
}
