'use client'

/* Barra de búsqueda + filtros + orden de las grillas de medios.
   La usan el "Total Repository" del panel y el selector "Choose from
   repository" del sitio: mismo criterio y misma UI en los dos lados, un solo
   lugar donde tocarlo. La lógica de filtrado vive aparte y pura en
   `lib/cms/media-filter`. */

import { useDeferredValue, useMemo, useState } from 'react'
import {
  DEFAULT_MEDIA_QUERY, type MediaKindFilter, type MediaQuery, type MediaSortBy,
} from '@/lib/cms/media-filter'

const KINDS: { value: MediaKindFilter; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: 'fa-layer-group' },
  { value: 'image', label: 'Images', icon: 'fa-image' },
  { value: 'video', label: 'Animations', icon: 'fa-film' },
]

const SORT_BY: { value: MediaSortBy; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'size', label: 'Size' },
]

/* El botón de sentido dice qué hace en cada combinación en vez de un genérico
   "ascending": una flecha sola no aclara si "arriba" es el más nuevo o el más
   viejo. */
const DIR_HINT: Record<string, string> = {
  'date:desc': 'Newest first', 'date:asc': 'Oldest first',
  'size:desc': 'Largest first', 'size:asc': 'Smallest first',
}

/* El filtro de estado NO viaja en `MediaQuery`: cada grilla habla su propio
   vocabulario (el panel usa `used|unused|trash`, el picker `usado|sin usar`) y
   el panel además lo persiste. La barra solo lo dibuja. */
export type StateFilterOption = {
  value: string
  label: string
  icon: string
  /** Modificador de color del chip activo (ver `.cms-repo-chip--*`). */
  tone?: 'used' | 'unused' | 'trash'
}

/** Estado de la barra. Devuelve dos valores a propósito:
 *  - `query`: lo que el input muestra, actualizado en cada tecla.
 *  - `applied`: lo que hay que filtrar, con el texto diferido.
 *  Así el tipeo nunca espera al re-render de la grilla (React 19,
 *  `useDeferredValue`), sin recurrir a un debounce con timers. */
export function useMediaQuery(initial?: Partial<MediaQuery>) {
  const [query, setQuery] = useState<MediaQuery>(() => ({ ...DEFAULT_MEDIA_QUERY, ...initial }))
  const deferredSearch = useDeferredValue(query.search)
  const applied = useMemo<MediaQuery>(
    () => ({ ...query, search: deferredSearch }),
    [query, deferredSearch],
  )
  return { query, setQuery, applied }
}

type Props = {
  value: MediaQuery
  onChange: (q: MediaQuery) => void
  /** Chips de estado. Si no se pasan, el grupo no se dibuja. */
  states?: StateFilterOption[]
  stateValue?: string
  onStateChange?: (v: string) => void
  /** Compacta la barra dentro del modal del picker, que tiene menos alto. */
  compact?: boolean
}

function Chip({ active, label, icon, tone, onClick }: {
  active: boolean; label: string; icon: string; tone?: string; onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`cms-repo-chip${tone ? ` cms-repo-chip--${tone}` : ''}${active ? ' active' : ''}`}
      aria-pressed={active}
      /* Bajo 380px el CSS oculta el texto: title y aria-label quedan como la
         única etiqueta del botón. */
      title={label} aria-label={label}
      onClick={onClick}
    >
      <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
      <span>{label}</span>
    </button>
  )
}

export default function MediaFilterBar({ value, onChange, states, stateValue, onStateChange, compact }: Props) {
  const dirKey = `${value.sortBy}:${value.sortDir}`
  const nextDir = value.sortDir === 'desc' ? 'asc' : 'desc'

  return (
    <div className={`cms-repo-tools${compact ? ' cms-repo-tools--compact' : ''}`}>
      <div className="cms-repo-search">
        <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <input
          type="text"
          className="cms-repo-search-input"
          placeholder="Search by file name"
          aria-label="Search by file name"
          autoComplete="off"
          spellCheck={false}
          value={value.search}
          onChange={(ev) => onChange({ ...value, search: ev.target.value })}
        />
        {value.search && (
          <button
            type="button" className="cms-repo-search-clear"
            aria-label="Clear search" title="Clear search"
            onClick={() => onChange({ ...value, search: '' })}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}
      </div>

      <div className="cms-repo-groups">
        {states && states.length > 0 && onStateChange && (
          <>
            <div className="cms-repo-chips" role="group" aria-label="Filter by state">
              {states.map((s) => (
                <Chip
                  key={s.value} active={stateValue === s.value} label={s.label}
                  icon={s.icon} tone={s.tone} onClick={() => onStateChange(s.value)}
                />
              ))}
            </div>
            <span className="cms-repo-divider" aria-hidden="true"></span>
          </>
        )}

        <div className="cms-repo-chips" role="group" aria-label="Filter by file type">
          {KINDS.map((k) => (
            <Chip
              key={k.value} active={value.kind === k.value} label={k.label}
              icon={k.icon} onClick={() => onChange({ ...value, kind: k.value })}
            />
          ))}
        </div>
      </div>

      <div className="cms-repo-sort">
        <label className="cms-repo-sort-field">
          <span className="cms-repo-sort-text">Sort</span>
          <select
            className="admin-select"
            value={value.sortBy}
            aria-label="Sort files by"
            onChange={(ev) => onChange({ ...value, sortBy: ev.target.value as MediaSortBy })}
          >
            {SORT_BY.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="cms-repo-sort-dir"
          title={DIR_HINT[dirKey]} aria-label={DIR_HINT[dirKey]}
          onClick={() => onChange({ ...value, sortDir: nextDir })}
        >
          <i
            className={`fa-solid ${value.sortDir === 'desc' ? 'fa-arrow-down-wide-short' : 'fa-arrow-up-short-wide'}`}
            aria-hidden="true"
          ></i>
        </button>
      </div>
    </div>
  )
}
