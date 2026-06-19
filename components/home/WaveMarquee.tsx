/* WaveMarquee — Infinite horizontal ribbon of tool/software bubbles.
   
   Structure (for CMS engine compatibility):
     .hero-software-wave
       └ .wave-track              ← CSS translateX animation
           └ .wave-group           ← one set of bubbles
               └ .wave-item       ← single bubble (data-cms-key on editable group)
                   └ .wave-icon-slot  ← icon filled via CMS
                   └ .wave-text       ← name span created by CMS WAVE_FIELDS

   The first group is the editable source of truth.
   Clone groups (aria-hidden) provide seamless loop visuals.
   engine.syncWaveGroups() mirrors content to clones. */

const SLOTS  = 11
const CLONES = 3

function Group() {
  return (
    <div className="wave-group">
      {Array.from({ length: SLOTS }, (_, i) => (
        <div
          key={i}
          className="wave-item"
          data-cms-key={`hero.marquee#${i}`}
        >
          <div className="wave-icon-slot" />
        </div>
      ))}
    </div>
  )
}

export default function WaveMarquee() {
  return (
    <div className="hero-software-wave">
      <div className="wave-track">
        <Group />
        {Array.from({ length: CLONES }, (_, i) => (
          <Group key={i} />
        ))}
      </div>
    </div>
  )
}
