'use client'

/* Contenedor de animación decorativa (settings.*AnimUrl).

   El contenedor manda: la caja, el recorte y la posición viven en la clase que
   recibe por prop; el archivo se adapta a ella y se puede reemplazar desde
   Gestión sin tocar CSS. Es decorativo puro: `aria-hidden` y sin eventos de
   puntero, así que nunca tapa un control ni entra en el orden de lectura.

   ROTACIÓN. Recibe una lista (principal + hasta 3 de rotación). Con una sola
   fuente no rota nada. Con más, cambia según `rotateOn`:
   - 'toggle' → al CERRARSE el panel que la aloja (drawer, panel de ajustes).
     El cambio ocurre con el panel cerrado y el archivo entrante se precarga en
     esa ventana muerta, así que al abrir ya está listo: nunca se ve el salto.
     El salto se espera `closeDelayMs`: el cierre es una transición CSS, no es
     instantáneo, y rotar al toque dejaba el clip nuevo a la vista durante todo
     el cierre. Si el panel se reabre antes de que venza, no rota — se vuelve a
     ver el mismo clip, que es justo lo que se espera.
   - 'load'   → una por montaje, siguiendo un contador en localStorage. Es lo
     que sirve para lo que se desmonta al cerrarse (el modal de contacto),
     donde un índice en memoria se perdería.
   - 'interval' → por reloj, cada `intervalMs`, mientras está EN PANTALLA (el
     temporizador no corre fuera de vista). Para lo que está siempre presente y
     nunca se abre ni se cierra: la barra superior y el footer. Arranca en un
     clip distinto en cada carga, con el mismo contador que 'load'.
   En 'load' e 'interval' el siguiente archivo se precarga mientras el actual
   está a la vista.

   VISIBILIDAD. Nunca corre fuera de pantalla: un IntersectionObserver gobierna
   los cuatro contenedores. `active` es una condición ADICIONAL para los que
   viven dentro de algo que se abre y se cierra: cerrado el contenedor sigue
   ocupando su lugar en el layout y el observer lo daría por visible.

   La pausa se encadena a la promesa de `play()`: cortarla en vuelo aborta esa
   promesa y el navegador la reporta como error en consola. */

import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '@/hooks/motion-flags'

const LS_ROTATION = 'cms_decor_anim_rot_v1'

/** Índice guardado para el próximo montaje de un contenedor 'load'. */
function nextRotationIndex(slot: string, total: number): number {
  try {
    const all = JSON.parse(localStorage.getItem(LS_ROTATION) || '{}') as Record<string, number>
    const i = Number.isFinite(all[slot]) ? all[slot] : 0
    all[slot] = (i + 1) % total
    localStorage.setItem(LS_ROTATION, JSON.stringify(all))
    return i % total
  } catch {
    return 0
  }
}

type Props = {
  /** Principal + rotación, ya sin huecos. Vacío → no se pinta nada. */
  sources: string[]
  /** Clase del contenedor: define caja, posición y recorte. */
  className: string
  /** Abierto/cerrado del contenedor anfitrión. Sin definir → siempre listo. */
  active?: boolean
  /** Cuándo pasa a la siguiente animación. */
  rotateOn?: 'toggle' | 'load' | 'interval'
  /** Identifica al contenedor en el contador de rotación ('load' e 'interval'). */
  slot?: string
  /** Período de rotación en ms (solo 'interval'). */
  intervalMs?: number
  /** Espera tras el cierre antes de rotar (solo 'toggle'). Tiene que cubrir la
   *  transición de cierre del panel anfitrión. */
  closeDelayMs?: number
}

export default function DecorAnim({ sources, className, active, rotateOn = 'toggle', slot, intervalMs, closeDelayMs = 600 }: Props) {
  const slotRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pending = useRef<Promise<void> | null>(null)
  const [idx, setIdx] = useState(0)
  /* `preload=auto` recién después del primer ciclo abrir/cerrar: hasta ahí el
     archivo puede no mirarse nunca y no hay motivo para bajarlo entero en la
     carga inicial. */
  const [warm, setWarm] = useState(false)
  /* Se encendió al menos una vez: hasta entonces no se baja NADA de la
     rotación. Nadie paga el archivo de la vuelta siguiente si todavía no vio
     el primero. */
  const [seen, setSeen] = useState(false)
  /* En pantalla ahora mismo. Gobierna el reloj de la rotación 'interval': un
     temporizador corriendo fuera de vista quemaría archivos que nadie mira. */
  const [visible, setVisible] = useState(false)
  /* Cerca del viewport. Hasta acá el elemento arranca en `preload="none"`: con
     "metadata" el navegador se trae el archivo ENTERO de cada contenedor
     decorativo apenas monta (medido en la portada: 5 instancias = 5,6 MB antes
     del primer scroll, y el mismo archivo bajado 3 veces por estar en 3
     secciones). El margen adelanta la carga lo suficiente como para que al
     entrar en cuadro ya tenga su primer frame. */
  const [nearObserved, setNearObserved] = useState(false)

  /* Cerca del viewport = hay que traer el primer frame. Para los contenedores
     de panel el disparador es la apertura, así que se deriva del render en vez
     de encenderse desde un efecto. */
  const near = nearObserved || active === true

  const list = sources.filter(Boolean)
  const total = list.length
  const signature = list.join('|')
  const current = total ? list[idx % total] : ''
  const upcoming = total > 1 ? list[(idx + 1) % total] : ''

  /* 'load': el índice sale del contador persistido y avanza para el próximo
     montaje. El guard es por instancia: en desarrollo StrictMode corre cada
     efecto dos veces y sin él el contador avanzaba dos posiciones por montaje,
     con lo que siempre caía en la misma. Un montaje de verdad (el modal que se
     cierra y se vuelve a abrir) trae un ref nuevo y sí vuelve a sortear. */
  const picked = useRef(false)
  useEffect(() => {
    if (rotateOn === 'toggle' || total < 2 || !slot || picked.current) return
    picked.current = true
    setIdx(nextRotationIndex(slot, total))
  }, [rotateOn, slot, total, signature])

  // 'interval': reloj propio, solo mientras el contenedor está a la vista.
  useEffect(() => {
    if (rotateOn !== 'interval' || total < 2 || !visible || active === false) return
    if (prefersReducedMotion()) return
    const id = setInterval(() => setIdx((i) => (i + 1) % total), intervalMs || 12000)
    return () => clearInterval(id)
  }, [rotateOn, total, visible, active, intervalMs])

  /* 'toggle': al cerrarse pasa a la siguiente, con el panel ya fuera de vista.
     La espera es obligatoria: el cierre es una transición CSS, no es
     instantáneo, y rotar en el acto dejaba el clip nuevo a la vista durante
     todo el cierre. Reabrir antes de que venza cancela la rotación — se vuelve
     a ver el mismo clip, que es lo que el usuario espera. */
  const prevActive = useRef(active)
  useEffect(() => {
    const closing = rotateOn === 'toggle' && total > 1 && prevActive.current === true && active === false
    prevActive.current = active
    if (!closing) return
    const id = setTimeout(() => {
      setIdx((i) => (i + 1) % total)
      setWarm(true)
    }, closeDelayMs)
    return () => clearTimeout(id)
  }, [active, rotateOn, total, closeDelayMs])

  /* Precarga por cercanía: separada del observer de reproducción porque usa
     otro margen y no debe reiniciarse cuando cambia el clip de la rotación.

     Un viewport completo de anticipación (`100%`), no 400px fijos: en un
     teléfono de 844px de alto, 400px es un tercio de pantalla y el clip no
     llegaba a decodificar antes de entrar en cuadro — se veía el hueco.
     El margen relativo da el mismo aire en cualquier tamaño.

     Los contenedores que viven DENTRO de un panel que se abre y se cierra
     (`active` definido: menú móvil, ajustes, desplegable de software) no los
     alcanza ningún observer: cerrados no tienen caja, así que nunca
     intersecan. Para esos el disparador es la APERTURA: `active` pasa a true
     al principio de la animación del panel, así que el archivo empieza a bajar
     mientras el panel todavía se está desplegando.
     No se precargan en reposo a propósito: son tres paneles y medido daba
     2,6 MB bajados en la carga inicial por clips que el visitante puede no
     abrir nunca. Mientras no haya frame, el contenedor se ve vacío en vez de
     negro (regla `has-frame`), que es justo lo que evita el parpadeo. */
  useEffect(() => {
    const box = slotRef.current
    // Los de panel no llevan observer: los enciende `active`, derivado arriba.
    if (!box || nearObserved || active !== undefined) return

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNearObserved(true); io.disconnect() }
    }, { rootMargin: '100% 0px' })
    io.observe(box)
    return () => io.disconnect()
  }, [nearObserved, active])

  useEffect(() => {
    const v = videoRef.current
    const box = slotRef.current
    if (!v || !box || !current || prefersReducedMotion()) return

    // El autoplay puede rechazarse (política del navegador): es decorativo, se ignora.
    const play = () => { setSeen(true); pending.current = v.play().catch(() => {}) }
    const stop = (rewind: boolean) => {
      void Promise.resolve(pending.current).then(() => {
        v.pause()
        if (rewind) v.currentTime = 0
      })
    }

    // Cerrado: ni siquiera se observa. El contenedor sigue en el layout, así que
    // el observer lo daría por visible y el video correría detrás del panel.
    if (active === false) { stop(true); return }
    if (active) v.currentTime = 0

    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting)
        if (entry.isIntersecting) play()
        else stop(false)
      },
      { threshold: 0.15 },
    )
    io.observe(box)
    return () => { io.disconnect(); setVisible(false); stop(active === true) }
  }, [current, active])

  if (!current) return null

  /* Precarga del entrante, siempre después de haber mostrado el actual. En
     'toggle' se hace con el panel cerrado (la ventana muerta que aprovechamos);
     en 'load', mientras el actual se ve, para que el próximo montaje lo
     encuentre en caché. */
  const preloadNext = !!upcoming && seen && (rotateOn !== 'toggle' || active === false)

  return (
    <div ref={slotRef} className={`decor-anim ${className}`} aria-hidden="true">
      <video
        key={current}
        ref={videoRef}
        className="decor-anim__media"
        src={current}
        loop
        muted
        playsInline
        preload={warm ? 'auto' : near ? 'metadata' : 'none'}
        disablePictureInPicture
        disableRemotePlayback
      />
      {preloadNext && (
        <video className="decor-anim__preload" src={upcoming} preload="auto" muted playsInline aria-hidden="true" />
      )}
    </div>
  )
}
