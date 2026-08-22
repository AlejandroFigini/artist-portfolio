'use client'

/* Renombrado inline de un ARCHIVO (no del contenedor: para eso está
   RenameContainerModal). Lo comparten la tarjeta del Repositorio —lápiz al
   hacer hover— y su vista previa.

   El nombre se aplica en Cloudinary (`display_name`) y recién cuando el
   servidor confirma se escribe en el estado local. Al revés, un fallo de red
   dejaría el CMS diciendo un nombre y Cloudinary otro. */

import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { ensureExtension, getFileBasename } from '@/lib/utils'
import { mediaFacts, recordAudit, renameMediaEverywhere, type MediaLike } from '@/lib/cms/store'
import { renameMedia } from '@/lib/api'

export type MediaRename = ReturnType<typeof useMediaRename>

export function useMediaRename(e: MediaLike) {
  const toast = useToast()
  const src = e.src || e.dataUrl || ''
  const facts = mediaFacts(e)

  /* `renamed` solo existe para la vista previa, que recibe una copia congelada
     del item: la tarjeta se repinta sola porque el store emite. */
  const [renamed, setRenamed] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const name = renamed ?? facts.name
  const basename = getFileBasename(name)
  /* Sin URL no hay asset que renombrar (contenedor vacío o entrada corrupta). */
  const canRename = !!src

  const start = () => { setDraft(basename); setEditing(true) }
  const cancel = () => { if (!busy) setEditing(false) }

  const save = async () => {
    if (busy) return
    const base = draft.trim()
    if (!base) { toast('The file name cannot be empty.', 'error'); return }
    if (base === basename) { setEditing(false); return }

    setBusy(true)
    const res = await renameMedia(src, base)
    setBusy(false)
    if (!res.ok) { toast(res.error || 'Could not rename the file.', 'error'); return }

    // La extensión no se edita: se conserva la del archivo original.
    const full = ensureExtension(res.name || base, name)
    renameMediaEverywhere(src, full)
    recordAudit({ section: e.section || '', label: full, summary: `File renamed (previously: ${name || '—'})` })
    setRenamed(full)
    setEditing(false)
    toast('File renamed')
  }

  return { name, editing, draft, setDraft, busy, canRename, start, cancel, save }
}

/** Lápiz que abre la edición. Su visibilidad en hover la maneja el CSS. */
export function MediaRenamePencil({ rename, className = '' }: { rename: MediaRename; className?: string }) {
  if (!rename.canRename) return null
  return (
    <button
      type="button"
      className={`cms-rename-file-btn ${className}`.trim()}
      title="Rename file" aria-label="Rename file"
      onClick={(ev) => { ev.stopPropagation(); rename.start() }}
    >
      {/* fa-pen: el mismo icono que usa todo "editar" del panel. */}
      <i className="fa-solid fa-pen" aria-hidden="true"></i>
    </button>
  )
}

/** Input + confirmar/descartar. Enter guarda, Escape descarta. */
export function MediaRenameEditor({ rename }: { rename: MediaRename }) {
  const ref = useRef<HTMLInputElement>(null)

  // Al abrir, el cursor va al input con el nombre preseleccionado.
  useEffect(() => { ref.current?.select() }, [])

  return (
    <span className="cms-rename-file" onClick={(ev) => ev.stopPropagation()}>
      <input
        ref={ref}
        type="text"
        className="cms-rename-file-input"
        aria-label="File name"
        autoComplete="off"
        spellCheck={false}
        disabled={rename.busy}
        value={rename.draft}
        onChange={(ev) => rename.setDraft(ev.target.value)}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); void rename.save() }
          else if (ev.key === 'Escape') { ev.preventDefault(); rename.cancel() }
        }}
      />
      <button
        type="button" className="cms-rename-file-action cms-rename-file-action--ok"
        title="Save name" aria-label="Save name"
        disabled={rename.busy}
        onClick={() => void rename.save()}
      >
        <i className={`fa-solid ${rename.busy ? 'fa-spinner fa-spin' : 'fa-check'}`} aria-hidden="true"></i>
      </button>
      <button
        type="button" className="cms-rename-file-action cms-rename-file-action--cancel"
        title="Discard changes" aria-label="Discard changes"
        disabled={rename.busy}
        onClick={rename.cancel}
      >
        <i className="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    </span>
  )
}
