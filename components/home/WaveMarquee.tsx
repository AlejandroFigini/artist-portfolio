/* Wave marquee de software — portado de index.html (hero-software-wave).
   El legacy duplicaba el grupo 4 veces a mano para el loop infinito en
   ultrawide; acá se mapea desde un solo array (grupos clon aria-hidden). */

const WAVE_ITEMS = [
  { src: 'https://cdn.simpleicons.org/adobeillustrator/FF9A00', alt: 'Ai', label: 'Illustrator' },
  { src: 'https://cdn.simpleicons.org/adobephotoshop/31A8FF', alt: 'Ps', label: 'Photoshop' },
  { src: 'https://cdn.simpleicons.org/adobeaftereffects/9999FF', alt: 'Ae', label: 'After Effects' },
  { src: 'https://cdn.simpleicons.org/adobepremierepro/EA77FF', alt: 'Pr', label: 'Premiere' },
  { src: 'https://cdn.simpleicons.org/blender/F5792A', alt: 'Blender', label: 'Blender' },
  { src: 'https://cdn.simpleicons.org/autodesk/0696D7', alt: '3ds Max', label: '3ds Max' },
  { src: 'https://cdn.simpleicons.org/unity/000000', alt: 'Unity', label: 'Unity' },
  { src: 'https://cdn.simpleicons.org/epicgames/FFFFFF', alt: 'Unreal', label: 'Unreal Engine' },
  { src: 'https://cdn.simpleicons.org/maxon/FFFFFF', alt: 'ZBrush', label: 'ZBrush' },
  { src: 'https://cdn.simpleicons.org/autodesk/0696D7', alt: 'Maya', label: 'Maya' },
  { src: 'https://cdn.simpleicons.org/adobe/FFFFFF', alt: 'Substance', label: 'Substance' },
]

const GROUPS = 4 // 1 visible + 3 clones para el loop infinito

function WaveGroup({ hidden }: { hidden?: boolean }) {
  return (
    <div className="wave-group" aria-hidden={hidden || undefined}>
      {WAVE_ITEMS.map((item) => (
        <div className="wave-item" key={item.label}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.src} className="wave-icon" alt={item.alt} />
          <span className="wave-text">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function WaveMarquee() {
  return (
    <div className="hero-software-wave">
      <div className="wave-track">
        {Array.from({ length: GROUPS }, (_, i) => (
          <WaveGroup key={i} hidden={i > 0} />
        ))}
      </div>
    </div>
  )
}
