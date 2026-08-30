'use client'

/* Modales del panel de gestión — port de admin.js: viewMediaModal,
   renameContainerModal, openAssociateContainerModal, editInfo y la
   subida directa a Cloudinary (sección "Subir contenido"). */

import { useEffect, useRef, useState, useMemo } from 'react'
import { CmsModal, useModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { fetchAssetId, uploadMedia, type UploadResponse } from '@/lib/api'
import { fmtBytes, fmtDateOnly, fmtTimeOnly, isVideo, getFileBasename, getFileExtension, ensureExtension } from '@/lib/utils'
import {
  state, getFormat, getContainerMeta, kindOf, recordAudit, emit,
  performRenameContainer, associateUnusedToContainer, associateUsedToContainer,
  loadJSON, saveJSON, LS, persistUsed, persistUnused, recordMediaMeta, getAllKnownContainerKeys,
  moveUsedToUnused, type UsedEntry,
} from '@/lib/cms/store'
import { buildPageTree, getPageAndSectionInfo } from '@/lib/cms/pages'
import {
  acceptsMediaKind, computeFields, elementsByKey, ensureCollectionMeta, metaByKey, persistOverrideKeys,
} from '@/components/cms/engine'
import { cloudinaryAssetUrl, cloudinarySearchUrl } from '@/lib/cloudinary-console'
import { Thumb, type AnyEntry } from './cards'
import { useMediaRename, MediaRenameEditor, MediaRenamePencil } from './RenameMedia'

type CloseProp = { onClose: () => void }

const toggleSet = (upd: (u: (prev: Set<string>) => Set<string>) => void, id: string) =>
  upd((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

// ----- Renombrar contenedor ----------------------------------------------------

export function RenameContainerModal({ cmsKey, onClose }: CloseProp & { cmsKey: string }) {
  const current =
    state.usedContent[cmsKey]?.label ||
    state.unused.find((x) => x.key === cmsKey)?.label ||
    state.containerNames[cmsKey] || cmsKey
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  return (
    <CmsModal
      title="Rename container" onClose={onClose}
      actions={[
        { label: 'Cancel', onClick: () => {} },
        { label: 'Save', primary: true, onClick: () => {
          const newLabel = inputRef.current?.value.trim() || ''
          if (!newLabel) { toast('Name cannot be empty.', 'error'); return false }
          performRenameContainer(cmsKey, newLabel)
        } },
      ]}
    >
      <div className="cms-upload">
        <div className="cms-meta-line" style={{ marginBottom: '1rem' }}><strong>Current container:</strong> {current}</div>
        <div className="cms-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span>New container name:</span>
          <input ref={inputRef} type="text" className="cms-input" style={{ width: '100%' }} defaultValue={current} autoFocus />
        </div>
      </div>
    </CmsModal>
  )
}

// ----- Asociar a contenedor ------------------------------------------------------

type AssociateProps = CloseProp & { item: AnyEntry; isUnused: boolean; unusedIdx: number }

export function AssociateContainerModal({ item, isUnused, unusedIdx, onClose }: AssociateProps) {
  const itemKind = kindOf(item)
  const allKeys = getAllKnownContainerKeys()
  // contenedores compatibles → entradas del árbol Página → Sección (mismo orden que "En uso")
  const containers = allKeys
    .map((k) => { const meta = getContainerMeta(k); return { key: k, section: meta.section, size: 0, meta, occ: state.usedContent[k] } })
  const tree = buildPageTree(containers)

  const [openPages, setOpenPages] = useState<Set<string>>(() => new Set())

  const choose = (targetKey: string) => {
    if (isUnused) associateUnusedToContainer(unusedIdx, targetKey)
    else associateUsedToContainer((item as { key?: string }).key || '', targetKey)
    onClose()
  }

  const contBadge = (n: number) => `${n} container${n === 1 ? '' : 's'}`

  return (
    <CmsModal title="Associate with container" wide onClose={onClose} actions={[{ label: 'Cancel', onClick: () => {} }]}>
      <div className="cms-upload" style={{ maxHeight: '60vh', overflowY: 'auto' }} data-lenis-prevent>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem', padding: '0.6rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            <Thumb e={item} />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name || item.label || '—'}</strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{kindOf(item) === 'video' ? 'Video / Animation' : 'Image'} {item.size ? `· ${fmtBytes(item.size)}` : ''}</span>
          </div>
        </div>
        <div className="admin-tree">
          {tree.map((page) => {
            const pOpen = openPages.has(page.id)
            const pageOcc = page.items.filter(c => c.occ).length
            return (
              <div className="admin-tree-page" key={page.id}>
                <div className={`admin-tree-row admin-tree-row--page${pOpen ? ' open' : ''}`}>
                  <button type="button" className="admin-tree-rowbtn" onClick={() => toggleSet(setOpenPages, page.id)} aria-expanded={pOpen}>
                    <i className="fa-solid fa-chevron-right admin-tree-caret"></i>
                    <i className={`fa-solid ${page.icon} admin-tree-icon`}></i>
                    <span className="admin-tree-label">{page.label}</span>
                    {page.count > 0 && (
                      <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', marginLeft: 'auto' }}>
                        <span className="admin-badge">{contBadge(page.count)}</span>
                        <span className="admin-badge" style={{ background: 'color-mix(in srgb, var(--accent) 15%, var(--bg-secondary))', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, var(--border))' }}>
                          {pageOcc} in use
                        </span>
                      </span>
                    )}
                  </button>
                </div>
                {pOpen && (
                  <div className="admin-tree-sections">
                    <div className="admin-tree-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                      {page.count === 0
                        ? <p className="cms-admin-sub admin-tree-empty">No containers in this page.</p>
                        : page.items.map((c) => {
                          // Regla única de compatibilidad (engine.ts).
                          const isCompat = acceptsMediaKind(c.meta.kind, itemKind)
                          return (
                          <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.7rem', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', minWidth: 0, flex: 1 }}>
                              {c.occ && (
                                <div style={{ width: '40px', height: '40px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Thumb e={c.occ} />
                                </div>
                              )}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', textAlign: 'left', minWidth: 0, flex: 1 }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{c.meta.label}</span>
                                <div style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                  {!isCompat && (
                                    <span className="cms-tag" style={{ background: '#ef4444', color: '#fff' }}>
                                      Incompatible ({c.meta.kind === 'video' ? 'requires video' : 'requires image'})
                                    </span>
                                  )}
                                  {c.occ ? (
                                    <>
                                      <span className="cms-tag" style={{ background: '#eab308', color: '#000' }}>In use</span>
                                      <span style={{ opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.occ.name}>({c.occ.name || 'file'})</span>
                                    </>
                                  ) : (
                                    <span className="cms-tag" style={{ background: '#22c55e', color: '#fff' }}>Free</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="cms-btn cms-btn--sm"
                              style={{ padding: '4px 10px', flexShrink: 0, opacity: isCompat ? 1 : 0.4, cursor: isCompat ? 'pointer' : 'not-allowed' }}
                              disabled={!isCompat}
                              onClick={() => { if (isCompat) choose(c.key) }}
                            >
                              Select
                            </button>
                          </div>
                          )
                        })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </CmsModal>
  )
}

// ----- Editar información (variante admin: campos de usedContent) -------------------

export function AdminEditInfoModal({ cmsKey, onClose }: CloseProp & { cmsKey: string }) {
  const toast = useToast()
  const entry = state.usedContent[cmsKey]
  /* Los campos salen del REGISTRO vivo, no del `fields` guardado en la
     entrada: ese es una foto del momento en que se sembro y no se refresca
     nunca. Una entrada escrita por el modal de subida se guarda SIN campos, y
     una sembrada desde /admin (donde la portada no esta montada) se guarda con
     `null` — en los dos casos el formulario salia incompleto o vacio.
     `ensureCollectionMeta` cubre proyectos y personajes, que no tienen
     elemento propio en el DOM. El snapshot queda de respaldo para los
     contenedores que solo existen mientras el sitio esta montado. */
  const fields = useMemo(() => {
    ensureCollectionMeta(cmsKey)
    const meta = metaByKey[cmsKey]
    const live = meta ? computeFields(cmsKey, elementsByKey[cmsKey] || null, meta) : null
    return live && live.length ? live : (entry?.fields || [])
  }, [cmsKey, entry])
  const refs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})

  if (!entry) return null

  return (
    <CmsModal
      title="Edit Information" wide onClose={onClose}
      actions={fields.length === 0
        ? [{ label: 'Close', primary: true, onClick: () => {} }]
        : [
            { label: 'Cancel', onClick: () => {} },
            { label: 'Save', primary: true, onClick: () => {
              /* Escribe en `state.items` y en el servidor, no solo en el cache
                 local: antes tocaba `cms_overrides_v1` y nada mas, asi que la
                 edicion no llegaba nunca a la DB ni al sitio. */
              const items = loadJSON<Record<string, string>>(LS.OVERRIDES, {})
              const changedKeys: string[] = []
              fields.forEach((f) => {
                const v = refs.current[f.key]?.value
                if (v == null || v === f.value) return
                const compositeKey = cmsKey + '::' + f.key
                state.items[compositeKey] = v
                items[compositeKey] = v
                f.value = v
                const stored = state.usedContent[cmsKey]?.fields?.find((z) => z.key === f.key)
                if (stored) stored.value = v
                changedKeys.push(compositeKey)
              })
              saveJSON(LS.OVERRIDES, items)
              persistUsed()
              if (changedKeys.length) {
                persistOverrideKeys(changedKeys).catch(() => toast('Network error while syncing with server', 'error'))
                recordAudit({ section: entry.section, label: entry.label, kind: 'metadata', summary: 'Information edited' })
              }
              emit()
              toast(changedKeys.length ? 'Container updated' : 'No changes')
            } },
          ]}
    >
      <div className="cms-upload">
        <div className="cms-up-head">
          <div className="cms-meta-line"><strong>Section:</strong> {entry.section}</div>
          <div className="cms-meta-line"><strong>Content:</strong> {entry.label}</div>
        </div>
        {fields.length === 0 ? (
          <p className="cms-admin-sub">This content has no editable information fields.</p>
        ) : (
          <div className="cms-up-fields">
            <div className="cms-fields-title">Information (shown in full screen)</div>
            {fields.map((f) => (
              <label className="cms-field" key={f.key}>
                <span>{f.label}</span>
                {f.textarea ? (
                  <textarea rows={2} defaultValue={f.value} ref={(n) => { refs.current[f.key] = n }} />
                ) : (
                  <input type="text" defaultValue={f.value} ref={(n) => { refs.current[f.key] = n }} />
                )}
              </label>
            ))}
          </div>
        )}
      </div>
    </CmsModal>
  )
}

// ----- Vista previa de contenido -----------------------------------------------------

type ViewProps = CloseProp & {
  e: AnyEntry
  cardType: 'used' | 'unused' | 'trash' | 'repo'
  menu: { label: React.ReactNode; onClick: () => void }[]
}

export function SelectContainerActionModal({
  action,
  occs,
  onSelect,
  onClose,
}: {
  action: 'editInfo' | 'rename' | 'remove'
  occs: UsedEntry[]
  onSelect: (key: string) => void
  onClose: () => void
}) {
  const { confirm } = useModal()
  const title = action === 'editInfo'
    ? 'Select container to edit info'
    : action === 'rename'
    ? 'Select container to rename'
    : 'Select container to remove content from'

  return (
    <CmsModal title={title} onClose={onClose} actions={[{ label: 'Cancel', onClick: () => {} }]}>
      <div style={{ padding: '0.3rem 0' }}>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          This file is currently used in <strong>{occs.length} containers</strong>. Select which container you want to {action === 'editInfo' ? 'edit details for' : action === 'rename' ? 'rename' : 'remove this content from'}:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '55vh', overflowY: 'auto' }} data-lenis-prevent>
          {occs.map((u) => {
            const info = getPageAndSectionInfo(u)
            const label = u.label || (u.key ? getContainerMeta(u.key).label : '') || u.key
            return (
              <div
                key={u.key}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                  padding: '0.75rem 1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: '8px', cursor: action !== 'remove' ? 'pointer' : 'default'
                }}
                onClick={action !== 'remove' ? () => { onClose(); onSelect(u.key) } : undefined}
              >
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem' }}>{label}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    <strong>Page:</strong> {info.page} · <strong>Section:</strong> {info.section}
                  </div>
                </div>
                <button
                  type="button"
                  className={action === 'remove' ? 'cms-btn cms-btn--sm cms-batch-danger' : 'cms-btn cms-btn--sm cms-btn--primary'}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    if (action === 'remove') {
                      const otherCount = occs.length - 1
                      if (otherCount > 0) {
                        confirm('Remove from container',
                          `Remove content from "${label}"? The file will stay active in ${otherCount} other container${otherCount > 1 ? 's' : ''}.`,
                          () => { moveUsedToUnused(u.key); onClose() })
                      } else {
                        confirm('Move to Unused',
                          `Remove content from "${label}" and move to Unused?`,
                          () => { moveUsedToUnused(u.key); onClose() })
                      }
                    } else {
                      onClose()
                      onSelect(u.key)
                    }
                  }}
                >
                  <i className={`fa-solid ${action === 'editInfo' ? 'fa-pen' : action === 'rename' ? 'fa-signature' : 'fa-xmark'}`} style={{ marginRight: '0.35rem' }}></i>
                  {action === 'editInfo' ? 'Edit info' : action === 'rename' ? 'Rename' : 'Remove'}
                </button>
              </div>
            )
          })}
        </div>
        {action === 'remove' && occs.length > 1 && (
          <div style={{ marginTop: '1.2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <button
              type="button"
              className="cms-btn cms-btn--sm cms-batch-danger"
              style={{ width: '100%', padding: '0.65rem' }}
              onClick={() => {
                confirm('Move all to Unused',
                  `Remove this file from ALL ${occs.length} containers and move it to Unused?`,
                  () => {
                    occs.forEach(u => moveUsedToUnused(u.key))
                    onClose()
                  })
              }}
            >
              <i className="fa-solid fa-folder-closed" style={{ marginRight: '0.4rem' }}></i>
              Remove from ALL ({occs.length}) containers & Move to Unused
            </button>
          </div>
        )}
      </div>
    </CmsModal>
  )
}

/** Nombre del archivo dentro del public_id de una URL de Cloudinary — lo que
 *  se escribe en el buscador de la consola cuando no hay `asset_id`. */
function publicIdOf(url: string): string {
  const m = url.match(/\/(image|video|raw)\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?(.+)$/)
  return m ? m[2].replace(/\.[a-zA-Z0-9]+$/, '') : ''
}

export function ViewMediaModal({ e, cardType, menu, onClose }: ViewProps) {
  const raw = e.src || e.dataUrl
  const src = !raw || raw === 'null' || raw === 'undefined' ? '' : raw

  /* "Manage asset" tiene que abrir la FICHA del archivo, no el buscador. La
     consola solo direcciona por `asset_id`, que no viaja en la URL del archivo:
     se pide al servidor al abrir la vista previa. Mientras no llega (o si el
     asset no es de Cloudinary) el enlace cae al buscador por nombre, que es lo
     que había antes. Los hooks van ANTES del early return: no pueden quedar
     detrás de una condición. */
  const [resolved, setResolved] = useState<{ url: string; id: string } | null>(null)
  useEffect(() => {
    if (!src.includes('cloudinary.com') || state.role === 'demo') return
    let alive = true
    fetchAssetId(src).then((id) => { if (alive && id) setResolved({ url: src, id }) })
    return () => { alive = false }
  }, [src])
  const assetId = resolved?.url === src ? resolved.id : null

  /* Renombrar el archivo: solo cuando la vista previa se abre desde el
     Repositorio, igual que el lápiz de la tarjeta. */
  const rename = useMediaRename(e)
  const canEditName = cardType === 'repo'

  if (!src) return null
  const vid = isVideo(e.type || (e as { kind?: string }).kind, e.name)
  const ts = cardType === 'trash' || (cardType === 'repo' && e._state === 'trash') ? e.deletedAt : e.ts
  const occs = e.src && cardType === 'used' ? Object.values(state.usedContent).filter(u => u.src === e.src) : []
  const occCount = cardType === 'used' ? occs.length : (e.src ? Object.values(state.usedContent).filter(u => u.src === e.src).length : 0)
  const containerBase = e.key ? getContainerMeta(e.key).label : ''
  const isUnusedOrTrash = cardType === 'unused' || cardType === 'trash' || e._state === 'unused' || e._state === 'trash'
  const containerLabel = isUnusedOrTrash ? 'Previous container:' : 'Container:'

  const consoleHref = assetId
    ? cloudinaryAssetUrl(assetId)
    : cloudinarySearchUrl(publicIdOf(src) || (e.name ? getFileBasename(e.name) : ''))

  return (
    <CmsModal
      title="Content Preview" wide compactActions onClose={onClose}
      actions={[
        // la acción cierra esta vista previa y abre el modal/confirm correspondiente;
        // devolver false evita que CmsModal dispare onClose por segunda vez (pisaba el setModal)
        ...menu.map((m) => ({ label: m.label, onClick: () => { onClose(); m.onClick(); return false as const } })),
        { label: <><i className="fa-solid fa-xmark" style={{ marginRight: 6 }}></i> Close</>, primary: true, onClick: () => {} },
      ]}
    >
      <div>
        {vid ? (
          <video src={src} controls autoPlay style={{ maxWidth: '100%', maxHeight: '40vh', borderRadius: 8, display: 'block', margin: '0 auto' }}></video>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: '40vh', borderRadius: 8, display: 'block', margin: '0 auto' }} />
        )}
        <div style={{ marginTop: '1.5rem', textAlign: 'left', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
          <h4 className="cms-rename-file-title" style={{ marginBottom: '0.5rem', color: 'var(--accent)', fontWeight: 700 }}>
            {canEditName && rename.editing ? (
              <MediaRenameEditor rename={rename} />
            ) : (
              <>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '0 1 auto', minWidth: 0 }}>
                  {getFileBasename(rename.name || e.label || 'Untitled')}
                </span>
                {canEditName && <MediaRenamePencil rename={rename} />}
              </>
            )}
          </h4>
          <div className="cms-mlib-meta" style={{ fontSize: '0.9rem', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div><strong>File name:</strong> {rename.name || '—'}</div>
            <div><strong>Format:</strong> {getFormat(e)}</div>
            <div><strong>Size:</strong> {fmtBytes(e.size)}</div>
            {/* Demo: se oculta info sensible (fecha/hora de subida y el enlace/URL
                a Cloudinary, incluido el download que expone la URL). */}
            {state.role !== 'demo' && (
            <div><strong>Upload date:</strong> {ts ? `${fmtDateOnly(ts)} ${fmtTimeOnly(ts)}` : '—'}</div>
            )}
            {state.role !== 'demo' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <div>
                <strong>Cloudinary console:</strong>{' '}
                <a
                  href={consoleHref}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                  title={assetId ? 'Open this asset in Cloudinary' : 'Open Cloudinary and search for this file'}
                >
                  Manage asset <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.8em', marginLeft: '2px' }}></i>
                </a>
              </div>
              <a 
                href={src.includes('/upload/') ? src.replace('/upload/', '/upload/fl_attachment/') : src} 
                download={e.name || 'download'} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="cms-btn cms-btn--sm" 
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.6rem' }}
                title="Download file"
              >
                <i className="fa-solid fa-download"></i> Download
              </a>
            </div>
            )}
            {occCount > 1 && (
              <div><strong>Uses:</strong> <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{`${occCount} times`}</span></div>
            )}
            {cardType === 'used' && occs.length > 1 ? (
              <div style={{ marginTop: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Containers in use ({occs.length}):</strong>
                  <span className="cms-info-tip" tabIndex={0} aria-label={`In use in ${occs.length} containers`}>
                    <i className="fa-solid fa-circle-info" style={{ color: 'var(--accent)', cursor: 'pointer' }}></i>
                    <span className="cms-info-bubble" role="tooltip" style={{ minWidth: '220px' }}>
                      <strong style={{ display: 'block', marginBottom: '0.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.2rem', color: 'var(--accent)' }}>
                        Container summary:
                      </strong>
                      {occs.map((u, i) => (
                        <div key={i} style={{ fontSize: '0.78rem', margin: '0.2rem 0', color: 'var(--text-primary)' }}>
                          • {u.label || (u.key ? getContainerMeta(u.key).label : '') || u.key}
                        </div>
                      ))}
                    </span>
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {occs.map((u) => {
                    const info = getPageAndSectionInfo(u)
                    return (
                      <div key={u.key} style={{ fontSize: '0.84rem', background: 'var(--bg-primary)', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{u.label || (u.key ? getContainerMeta(u.key).label : '') || u.key}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{info.page} / {info.section}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div><strong>{containerLabel}</strong> <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{containerBase || '—'}</span></div>
            )}
          </div>
        </div>
      </div>
    </CmsModal>
  )
}

// ----- Subida directa (sección "Subir contenido") --------------------------------------

type QueueItem = { file: File; name: string }
type UploadOk = UploadResponse & { original_name: string; isVid: boolean }
type UploadFail = { name: string; size: number; error: string }

/* Cuántos resultados muestran vista previa. Con lotes grandes (90 archivos)
   montar un <video>/<img> por resultado tira el navegador abajo. */
const PREVIEW_LIMIT = 3

/* Intentos por archivo. La falla típica de un lote grande es transitoria: el
   navegador no llega a leer el archivo entero (OneDrive/iCloud lo tienen sin
   descargar) y el multipart sale cortado. Al segundo intento ya está en disco. */
const UPLOAD_ATTEMPTS = 3

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function uploadWithRetry(file: File, finalName: string): Promise<UploadResponse> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt++) {
    try {
      return await uploadMedia(file, finalName, 'Direct uploads', 'unused')
    } catch (err) {
      lastErr = err
      if (attempt < UPLOAD_ATTEMPTS) await wait(attempt * 600)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

export function AdminUploadModal({ files, onClose }: CloseProp & { files: File[] }) {
  const [phase, setPhase] = useState<'form' | 'uploading' | 'done'>('form')
  const [results, setResults] = useState<UploadOk[]>([])
  const [failures, setFailures] = useState<UploadFail[]>([])
  const [progressIndex, setProgressIndex] = useState(0)

  /* La cola es editable: archivo + nombre base viajan juntos para que sacar un
     ítem no desalinee los nombres con los archivos. */
  const [queue, setQueue] = useState<QueueItem[]>(() =>
    files.map((f) => ({ file: f, name: getFileBasename(f.name) })))

  // Un duplicado por ítem: contra el repositorio y contra el resto del lote.
  const duplicates = useMemo(() => {
    const finalNameOf = (q: QueueItem) =>
      ensureExtension(q.name.trim() || getFileBasename(q.file.name), q.file.name).toLowerCase()
    return queue.map((q, i) => {
      const nameLower = finalNameOf(q)
      const inRepo = Object.values(state.usedContent).some((u) => u.name?.toLowerCase() === nameLower)
        || state.unused.some((u) => u.name?.toLowerCase() === nameLower)
      const inBatch = queue.some((other, j) => j !== i && finalNameOf(other) === nameLower)
      return inRepo || inBatch
    })
    /* state.usedContent y state.unused se REASIGNAN en el store (no solo se
       mutan), así que su identidad cambia y son dependencias reales: sacarlas
       dejaría la lista de duplicados desactualizada tras un guardado. El
       linter no puede saberlo porque viven fuera del componente. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, state.usedContent, state.unused])

  const dupCount = duplicates.filter(Boolean).length
  const hasAnyDuplicate = dupCount > 0

  const handleNameChange = (index: number, newName: string) =>
    setQueue((prev) => prev.map((q, i) => (i === index ? { ...q, name: newName } : q)))

  // Sacar el último ítem deja la cola vacía → no hay nada que subir, se cierra.
  const dropWhere = (drop: (index: number) => boolean) =>
    setQueue((prev) => {
      const next = prev.filter((_, i) => !drop(i))
      if (next.length === 0) onClose()
      return next
    })

  const removeAt = (index: number) => dropWhere((i) => i === index)
  const removeDuplicates = () => dropWhere((i) => duplicates[i])

  /* Un archivo que falla NO corta el lote: se anota y sigue. Antes un 400 en el
     archivo 40 dejaba 39 subidos sin persistir y sin forma de saber cuáles. */
  const doUpload = () => {
    void (async () => {
      setPhase('uploading')
      const uploaded: UploadOk[] = []
      const failed: UploadFail[] = []

      for (let i = 0; i < queue.length; i++) {
        setProgressIndex(i + 1)
        const { file, name } = queue[i]
        const isVid = file.type.includes('video') || /\.(webm|mp4|mov)$/i.test(file.name)
        const finalName = ensureExtension(name.trim() || getFileBasename(file.name), file.name)
        try {
          const data = await uploadWithRetry(file, finalName)

          // historial de las últimas 3 subidas (LS_UPLOAD_TEST)
          const hist = loadJSON<Record<string, unknown>[]>(LS.UPLOAD_TEST, [])
          hist.unshift({ ...data, origSize: file.size, origType: file.type, originalName: finalName, ts: Date.now() })
          if (hist.length > 3) hist.length = 3
          saveJSON(LS.UPLOAD_TEST, hist)

          // entra al repositorio como "sin usar"
          state.unused.push({
            src: data.secure_url, dataUrl: data.secure_url, name: finalName, size: data.final_bytes,
            type: isVid ? 'video/webm' : 'image/webp', ts: Date.now(),
            label: finalName, section: '', original: true, reason: 'upload',
          })
          recordMediaMeta('', data.secure_url, { name: finalName, size: data.final_bytes, type: isVid ? 'video/webm' : 'image/webp', label: finalName, section: 'Direct uploads' })
          uploaded.push({ ...data, original_name: finalName, isVid })
          /* Persistir archivo a archivo (el store lo debouncea): si el lote se
             interrumpe, lo ya subido queda registrado en el repositorio. */
          persistUnused()
        } catch (err: unknown) {
          failed.push({ name: finalName, size: file.size, error: err instanceof Error ? err.message : String(err) })
        }
      }

      persistUnused()
      emit()
      setResults(uploaded)
      setFailures(failed)
      setPhase('done')
    })()
    return false as const
  }

  const totalBytes = queue.reduce((acc, q) => acc + q.file.size, 0)

  const actions =
    phase === 'form'
      ? [
          { label: 'Cancel', onClick: () => {} },
          {
            label: queue.length > 1 ? `Compress and upload ${queue.length} files` : 'Compress and upload to Cloudinary',
            primary: true,
            disabled: hasAnyDuplicate,
            title: hasAnyDuplicate ? 'Rename the duplicated files, or remove them from the queue' : undefined,
            onClick: doUpload,
          },
        ]
      : phase === 'uploading'
        ? []
        : [{ label: 'Close and update', primary: true, onClick: () => {} }]

  return (
    <CmsModal title="Upload New Content" wide locked={phase === 'uploading'} onClose={onClose} actions={actions}>
      {phase === 'form' && (
        <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 12, border: '1px solid var(--border)' }}>
          {queue.length === 1 ? (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>File name</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input type="text" className="cms-field" value={queue[0].name}
                    onChange={(e) => handleNameChange(0, e.target.value)}
                    style={{ flex: 1, width: '100%', padding: '0.6rem', borderRadius: 8, borderTopRightRadius: getFileExtension(queue[0].file.name) ? 0 : 8, borderBottomRightRadius: getFileExtension(queue[0].file.name) ? 0 : 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'inherit' }} />
                  {getFileExtension(queue[0].file.name) && (
                    <span style={{ padding: '0.6rem 0.75rem', background: 'var(--bg-primary)', borderWidth: '1px 1px 1px 0', borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: '0 8px 8px 0', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono), monospace', fontSize: '0.85rem', userSelect: 'none' }}>
                      {getFileExtension(queue[0].file.name)}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div><strong>Size:</strong> <span style={{ fontFamily: 'var(--font-mono), monospace' }}>{fmtBytes(queue[0].file.size)}</span></div>
                <div><strong>Content type:</strong> {queue[0].file.type.includes('video') ? 'Video' : 'Image'}</div>
                <div><strong>Format:</strong> {queue[0].file.type || 'File'}</div>
              </div>
              {hasAnyDuplicate && (
                <div style={{ padding: '0.75rem', marginTop: '1rem', background: 'color-mix(in srgb, #ef4444 15%, transparent)', border: '1px solid #ef4444', borderRadius: 8, color: '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ marginTop: '0.2rem' }}></i>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.2rem' }}>Name already in use</strong>
                    There is already a file with this exact name in the repository. Rename it above, or cancel the upload.
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <i className="fa-solid fa-layer-group" style={{ color: 'var(--accent)', marginRight: '0.4rem' }}></i>
                    {queue.length} files queued for upload:
                  </label>
                  {hasAnyDuplicate && (
                    <button type="button" className="cms-btn cms-btn--sm" onClick={removeDuplicates}
                      style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}>
                      <i className="fa-solid fa-broom" style={{ marginRight: '0.35rem' }}></i>
                      Remove {dupCount} duplicate{dupCount > 1 ? 's' : ''}
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: '350px', overflowY: 'auto', background: 'var(--bg-primary)', padding: '0.8rem', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }} data-lenis-prevent>
                  {queue.map((q, i) => {
                    const isDup = duplicates[i]
                    const ext = getFileExtension(q.file.name)
                    return (
                      <div key={`${q.file.name}-${q.file.lastModified}-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingBottom: '0.6rem', borderBottom: i < queue.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                            <i className={`fa-solid ${q.file.type.includes('video') ? 'fa-film' : 'fa-image'}`} style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }}></i>
                            File {i + 1}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span style={{ fontFamily: 'var(--font-mono), monospace', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{fmtBytes(q.file.size)}</span>
                            <button
                              type="button"
                              onClick={() => removeAt(i)}
                              title="Remove from the upload queue"
                              aria-label={`Remove ${q.name || q.file.name} from the upload queue`}
                              style={{ background: 'transparent', border: 'none', color: isDup ? '#ef4444' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.95rem', lineHeight: 1, padding: '0.15rem 0.3rem' }}
                            >
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <input type="text" className="cms-field" value={q.name}
                            onChange={(e) => handleNameChange(i, e.target.value)}
                            style={{ flex: 1, width: '100%', padding: '0.4rem 0.6rem', borderRadius: 6, borderTopRightRadius: ext ? 0 : 6, borderBottomRightRadius: ext ? 0 : 6, border: `1px solid ${isDup ? '#ef4444' : 'var(--border)'}`, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '0.85rem' }} />
                          {ext && (
                            <span style={{ padding: '0.4rem 0.6rem', background: 'var(--bg-secondary)', borderWidth: '1px 1px 1px 0', borderStyle: 'solid', borderColor: isDup ? '#ef4444' : 'var(--border)', borderRadius: '0 6px 6px 0', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono), monospace', fontSize: '0.85rem', userSelect: 'none' }}>
                              {ext}
                            </span>
                          )}
                        </div>
                        {isDup && (
                          <span style={{ color: '#ef4444', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <i className="fa-solid fa-triangle-exclamation"></i> Already in the repository — rename it, or remove it with the ×
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <strong>Total size:</strong> <span style={{ fontFamily: 'var(--font-mono), monospace' }}>{fmtBytes(totalBytes)}</span>
              </div>
              {hasAnyDuplicate && (
                <div style={{ padding: '0.75rem', marginTop: '1rem', background: 'color-mix(in srgb, #ef4444 15%, transparent)', border: '1px solid #ef4444', borderRadius: 8, color: '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ marginTop: '0.2rem' }}></i>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.2rem' }}>{dupCount} duplicate name{dupCount > 1 ? 's' : ''} detected</strong>
                    Those files already exist in the repository (or clash with each other in this batch). Rename them, or drop them from the queue with the × so only the new ones are uploaded.
                  </div>
                </div>
              )}
            </>
          )}
          <p className="cms-admin-sub" style={{ margin: '1rem 0 0' }}>Processed with cloud AI for maximum optimization.</p>
        </div>
      )}
      {phase === 'uploading' && (
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <i className="fa-solid fa-circle-notch fa-spin fa-3x" style={{ color: 'var(--accent)' }}></i>
          <h3 style={{ marginTop: '1rem', color: 'var(--text-primary)' }}>
            {queue.length > 1 ? `Uploading file ${progressIndex} of ${queue.length}...` : 'Uploading and compressing...'}
          </h3>
          <p className="cms-admin-sub">This may take a few seconds depending on file size.</p>
        </div>
      )}
      {phase === 'done' && (
        <div style={{ padding: '1.5rem', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-secondary)', maxHeight: '65vh', overflowY: 'auto' }} data-lenis-prevent>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="fa-solid fa-cloud-arrow-up" style={{ color: 'var(--accent)' }}></i>{' '}
            {results.length === 1 ? 'Upload successful' : `${results.length} files uploaded successfully`}
          </h3>

          {failures.length > 0 && (
            <div style={{ padding: '0.9rem', marginBottom: '1.5rem', background: 'color-mix(in srgb, #ef4444 15%, transparent)', border: '1px solid #ef4444', borderRadius: 8, color: '#ef4444', fontSize: '0.85rem' }}>
              <strong style={{ display: 'block', marginBottom: '0.4rem' }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '0.4rem' }}></i>
                {failures.length} file{failures.length > 1 ? 's' : ''} failed and stayed out of the repository
              </strong>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {failures.map((f, i) => (
                  <li key={i}>
                    <span style={{ fontFamily: 'var(--font-mono), monospace' }}>{f.name}</span>{' '}
                    <span style={{ opacity: 0.75 }}>({fmtBytes(f.size)})</span> — {f.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: results.length > PREVIEW_LIMIT ? '0.4rem' : '1.5rem' }}>
            {results.map((result, i) => (
              <div key={i} style={{ background: 'var(--bg-primary)', padding: results.length > PREVIEW_LIMIT ? '0.5rem 0.75rem' : '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                {results.length > PREVIEW_LIMIT ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <i className={`fa-solid ${result.isVid ? 'fa-film' : 'fa-image'}`} style={{ marginRight: '0.5rem' }}></i>
                      {result.original_name}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono), monospace', flexShrink: 0 }}>{fmtBytes(result.final_bytes)}</span>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
                      <div><strong style={{ color: 'var(--text-primary)' }}>File:</strong> {result.original_name}</div>
                      <div><strong style={{ color: 'var(--text-primary)' }}>Final size:</strong> <span style={{ fontFamily: 'var(--font-mono), monospace' }}>{fmtBytes(result.final_bytes)}</span></div>
                      <div><strong style={{ color: 'var(--text-primary)' }}>Format:</strong> {result.final_format}</div>
                    </div>
                    {result.isVid ? (
                      <video src={result.secure_url} controls preload="none" style={{ maxWidth: '100%', maxHeight: '30vh', borderRadius: 8, display: 'block', margin: '0 auto' }}></video>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={result.secure_url} alt="Upload" loading="lazy" style={{ maxWidth: '100%', maxHeight: '30vh', objectFit: 'contain', borderRadius: 8, display: 'block', margin: '0 auto' }} />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </CmsModal>
  )
}

// ----- Auditoría de sincronización Cloudinary vs Gestión ----------------------

export type SyncAuditResult = {
  /** Un archivo por fila; `uses` = contenedores que lo muestran. */
  matching: { url: string; name: string; state: string; cloudinaryId: string; uses?: number }[]
  orphaned: { url: string; publicId: string; resourceType: string; format: string; bytes: number; folder: string }[]
  /** Contenedores que apuntan a un archivo que no existe en ningún lado. */
  broken: { url: string; name: string; state: string; section: string }[]
  /** El asset existe pero su estado en Cloudinary no es el que la DB implica. */
  folderMismatch: { url: string; name: string; state: string; section: string; cloudinaryId: string; actualFolder: string; expectedFolder: string }[]
  /** El archivo existe con otro public_id: la URL guardada quedó muerta. */
  stale: { url: string; name: string; state: string; section: string; cloudinaryId: string; fixedTo: string }[]
  /** Cuánto arregla un "Apply repairs" y cuánto vacía un "Purge". */
  repairable: number
  purgeable: number
  /* Balance archivo a archivo. `cloudinaryBytes` es el peso de los ORIGINALES
     que Cloudinary lista: la consola de Cloudinary muestra más porque suma las
     variantes derivadas de cada transformación y los backups, que el CMS no
     administra. Comparar contra ese número es lo que no cerraba nunca. */
  cloudinaryAssets: number
  cloudinaryBytes: number
  indexedFiles: number
  indexedBytes: number
  /** Archivos del índice sin tamaño conocido (no entran en `indexedBytes`). */
  indexedUnknown: number
  /* EL veredicto. Cuatro filas, dos columnas, cantidad y bytes: si una sola
     casilla difiere no está sincronizado, sin importar que los totales empaten.
     Antes sólo se comparaban totales y por eso un archivo mal clasificado —uno
     de menos en un apartado y uno de más en otro— pasaba como "todo ok". */
  balance: SyncBalance
  /** Archivos de Cloudinary que el panel no tenía y una reparación adopta. */
  adopted: number
}

export type SyncBucket = { files: number; bytes: number }
export type SyncBucketKey = 'used' | 'unused' | 'trash' | 'settings'
export type SyncBalance = {
  cloudinary: Record<SyncBucketKey, SyncBucket>
  panel: Record<SyncBucketKey, SyncBucket>
  match: Record<SyncBucketKey, boolean>
  panelUnknown: number
  balanced: boolean
}

const EMPTY_BUCKETS: Record<SyncBucketKey, SyncBucket> = {
  used: { files: 0, bytes: 0 }, unused: { files: 0, bytes: 0 },
  trash: { files: 0, bytes: 0 }, settings: { files: 0, bytes: 0 },
}

/** Balance vacío para una respuesta vieja o incompleta. `balanced: false` a
 *  propósito: sin datos no se afirma que esté sincronizado. */
export const emptySyncBalance = (): SyncBalance => ({
  cloudinary: { ...EMPTY_BUCKETS }, panel: { ...EMPTY_BUCKETS },
  match: { used: false, unused: false, trash: false, settings: false },
  panelUnknown: 0, balanced: false,
})

const BUCKET_ROWS: { key: SyncBucketKey; label: string; icon: string; hint: string }[] = [
  { key: 'used', label: 'In use', icon: 'fa-check', hint: 'Gallery files a container is showing on the site.' },
  { key: 'unused', label: 'Unused', icon: 'fa-folder-closed', hint: 'Retired files, kept for reuse.' },
  { key: 'trash', label: 'Trash', icon: 'fa-trash-can', hint: 'Files marked for deletion.' },
  { key: 'settings', label: 'Site settings', icon: 'fa-sliders', hint: 'CV, tab icon, loading screen and decorative animations. They are in use but are not gallery content, so they never appear in the "In use" count.' },
]

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const bom = '\uFEFF'
  const csv = bom + [headers.join(','), ...rows.map((r) => r.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function SyncAuditModal({ result, onClose }: CloseProp & { result: SyncAuditResult }) {
  const toast = useToast()
  const [tab, setTab] = useState<'matching' | 'orphaned' | 'broken' | 'folderMismatch' | 'stale'>('stale')
  const [localResult, setLocalResult] = useState<SyncAuditResult>(result)
  /* Respuesta sin `balance` (servidor viejo o error a medio parsear): se pinta
     un balance vacío y NO balanceado. Afirmar "sincronizado" sin haber podido
     comparar es exactamente el fallo que se está corrigiendo. */
  const balance = localResult.balance ?? emptySyncBalance()
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isFixing, setIsFixing] = useState(false)

  const downloadReport = () => {
    const rows: string[][] = []
    localResult.matching.forEach((r) => rows.push([r.name, r.url, r.state, r.cloudinaryId, `Synced (${r.uses ?? 1} container(s))`]))
    localResult.orphaned.forEach((r) => rows.push([r.publicId, r.url, 'N/A', r.publicId, 'Orphaned in Cloudinary']))
    localResult.broken.forEach((r) => rows.push([r.name, r.url, r.state, 'N/A', 'Missing from storage']))
    localResult.stale.forEach((r) => rows.push([r.name, r.url, r.state, r.cloudinaryId, `Stale URL: the file now lives at ${r.fixedTo}`]))
    localResult.folderMismatch.forEach((r) => rows.push([r.name, r.url, r.state, r.cloudinaryId, `State mismatch: expected ${r.expectedFolder}, tagged as ${r.actualFolder}`]))
    downloadCsv(
      `sync-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Name', 'URL', 'CMS State', 'Cloudinary ID', 'Status'],
      rows,
    )
  }

  /* Reparar y vaciar son la MISMA operación del servidor con distinto alcance:
     `purge` agrega el vaciado de contenedores sin archivo detrás. Se resuelve
     entero en el backend porque es el único lado que ve `cms_data`; el panel
     sólo dispara y vuelve a pedir el diagnóstico. */
  const runReconcile = async (purge: boolean) => {
    setIsFixing(true)
    try {
      const res = await fetch('/api/media/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purge }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      toast(`${data.applied || 0} fixes applied. Reload the panel to see the result.`, 'success')
      onClose()
    } catch (err) {
      toast(`Repair failed: ${err instanceof Error ? err.message : 'unknown error'}`, 'error')
    } finally {
      setIsFixing(false)
    }
  }

  const repairBtnStyle = (bg: string): React.CSSProperties => ({
    background: isFixing ? '#94a3b8' : bg, color: '#fff', border: 'none',
    padding: '0.4rem 0.8rem', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600,
    cursor: isFixing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
  })

  const handleDeleteOrphan = async (url: string, publicId: string) => {
    if (!confirm('Are you sure you want to permanently delete this orphaned file from Cloudinary?')) return
    setIsDeleting(publicId)
    try {
      const res = await fetch('/api/delete-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      if (!res.ok) throw new Error('Delete failed')
      setLocalResult(prev => ({
        ...prev,
        orphaned: prev.orphaned.filter(o => o.publicId !== publicId)
      }))
    } catch (err) {
      alert('Failed to delete file. Check console for details.')
      console.error(err)
    } finally {
      setIsDeleting(null)
    }
  }

  const tabStyle = (t: string): React.CSSProperties => ({
    padding: '0.5rem 1rem', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
    fontWeight: tab === t ? 700 : 400,
    background: tab === t ? 'var(--bg-secondary)' : 'transparent',
    color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
    fontSize: '0.9rem',
  })

  return (
    <CmsModal
      title={<><i className="fa-solid fa-magnifying-glass-chart" style={{ marginRight: '0.5rem' }}></i> Sync Audit: Cloudinary vs Management</>}
      onClose={onClose}
      wide
      actions={[
        { label: 'Download CSV Report', onClick: () => { downloadReport(); return false } },
        { label: 'Close', primary: true, onClick: () => {} },
      ]}
    >
      {/* EL veredicto. Va ARRIBA de todo porque es la pregunta real: ¿cada
          apartado del panel tiene los mismos archivos y los mismos bytes que
          Cloudinary? Se compara fila por fila, no por totales: dos totales
          iguales pueden esconder un archivo mal clasificado. */}
      <div style={{ marginBottom: '1rem', borderRadius: 12, background: 'var(--bg-secondary)', border: `1px solid ${balance.balanced ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)'}`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 1rem', background: balance.balanced ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }}>
          <i className={`fa-solid ${balance.balanced ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} style={{ color: balance.balanced ? '#22c55e' : '#ef4444', fontSize: '1.1rem' }}></i>
          <strong style={{ color: 'var(--text-primary)' }}>
            {balance.balanced ? 'In sync: every section matches Cloudinary, file for file and byte for byte.' : 'Not in sync: at least one section does not match Cloudinary.'}
          </strong>
        </div>
        <div className="cms-audit-table-wrap">
          <table className="cms-audit-table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Cloudinary</th>
                <th>Management</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody>
              {BUCKET_ROWS.map((row) => {
                const c = balance.cloudinary[row.key]
                const m = balance.panel[row.key]
                const ok = balance.match[row.key]
                const dFiles = m.files - c.files
                const dBytes = m.bytes - c.bytes
                return (
                  <tr key={row.key}>
                    <td>
                      <i className={`fa-solid ${row.icon}`} style={{ marginRight: '0.4rem', opacity: 0.7 }}></i>
                      {row.label}
                      <span className="cms-info-tip" tabIndex={0} style={{ marginLeft: '0.35rem' }}>
                        <i className="fa-solid fa-circle-info" style={{ opacity: 0.55 }}></i>
                        <span className="cms-info-bubble" role="tooltip" style={{ fontWeight: 'normal', textTransform: 'none', whiteSpace: 'normal', minWidth: '240px' }}>{row.hint}</span>
                      </span>
                    </td>
                    <td>{c.files} files · {fmtBytes(c.bytes)}</td>
                    <td>{m.files} files · {fmtBytes(m.bytes)}</td>
                    <td style={{ color: ok ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                      {ok ? <><i className="fa-solid fa-check"></i> match</> : (
                        <>
                          {dFiles !== 0 && <>{dFiles > 0 ? '+' : ''}{dFiles} files</>}
                          {dFiles !== 0 && dBytes !== 0 && ' · '}
                          {dBytes !== 0 && <>{dBytes > 0 ? '+' : ''}{fmtBytes(Math.abs(dBytes))}</>}
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
              <tr style={{ fontWeight: 700 }}>
                <td>Total</td>
                <td>{localResult.cloudinaryAssets} files · {fmtBytes(localResult.cloudinaryBytes)}</td>
                <td>
                  {localResult.indexedFiles} files · {fmtBytes(localResult.indexedBytes)}
                  {localResult.indexedUnknown > 0 && (
                    <span title="Files the panel lists but Cloudinary does not have, so they cannot be weighed">
                      {' '}(+{localResult.indexedUnknown} unmeasured)
                    </span>
                  )}
                </td>
                <td style={{ color: localResult.indexedFiles === localResult.cloudinaryAssets && localResult.indexedBytes === localResult.cloudinaryBytes ? '#22c55e' : '#ef4444' }}>
                  {localResult.indexedFiles - localResult.cloudinaryAssets > 0 ? '+' : ''}
                  {localResult.indexedFiles - localResult.cloudinaryAssets} files
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.6rem 1rem', lineHeight: 1.5 }}>
          Sizes come from Cloudinary itself, not from what the panel had cached. Both columns count
          original files only: Cloudinary&apos;s own dashboard reports more because it also bills the
          derived variants each transformation generates plus backups, and neither is managed from here.
          {localResult.adopted > 0 && (
            <> <strong>{localResult.adopted}</strong> file(s) exist in Cloudinary and are missing from every
            section of the panel; repairing adds them to Unused so both sides end up with the same count.</>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120, padding: '1rem', borderRadius: 12, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#22c55e' }}>{localResult.matching.length}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Synced files</div>
        </div>
        <div style={{ flex: 1, minWidth: 120, padding: '1rem', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444' }}>{localResult.orphaned.length}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Orphaned</div>
        </div>
        <div style={{ flex: 1, minWidth: 120, padding: '1rem', borderRadius: 12, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#eab308' }}>{localResult.broken.length}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Missing</div>
        </div>
        <div style={{ flex: 1, minWidth: 120, padding: '1rem', borderRadius: 12, background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#a855f7' }}>{localResult.stale.length}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Stale URLs</div>
        </div>
        <div style={{ flex: 1, minWidth: 120, padding: '1rem', borderRadius: 12, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#3b82f6' }}>{localResult.folderMismatch.length}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Wrong State</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border)', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button type="button" style={tabStyle('stale')} onClick={() => setTab('stale')}>
          <i className="fa-solid fa-link" style={{ marginRight: '0.4rem', color: '#a855f7' }}></i>
          Stale URLs ({localResult.stale.length})
        </button>
        <button type="button" style={tabStyle('folderMismatch')} onClick={() => setTab('folderMismatch')}>
          <i className="fa-solid fa-folder-tree" style={{ marginRight: '0.4rem', color: '#3b82f6' }}></i>
          Wrong State ({localResult.folderMismatch.length})
        </button>
        <button type="button" style={tabStyle('orphaned')} onClick={() => setTab('orphaned')}>
          <i className="fa-solid fa-ghost" style={{ marginRight: '0.4rem', color: '#ef4444' }}></i>
          Orphaned ({localResult.orphaned.length})
        </button>
        <button type="button" style={tabStyle('broken')} onClick={() => setTab('broken')}>
          <i className="fa-solid fa-link-slash" style={{ marginRight: '0.4rem', color: '#eab308' }}></i>
          Broken refs ({localResult.broken.length})
        </button>
        <button type="button" style={tabStyle('matching')} onClick={() => setTab('matching')}>
          <i className="fa-solid fa-circle-check" style={{ marginRight: '0.4rem', color: '#22c55e' }}></i>
          Synced ({localResult.matching.length})
        </button>
      </div>

      {/* Tab content */}
      <div style={{ maxHeight: '40vh', overflow: 'auto' }}>
        {tab === 'stale' && (
          localResult.stale.length === 0
            ? <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                <i className="fa-solid fa-circle-check" style={{ color: '#22c55e', marginRight: '0.5rem' }}></i>
                No stale URLs. Every container points at the file&apos;s current address.
              </p>
            : <div>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    The file still exists in Cloudinary under a different public ID, so the saved URL is dead. Repairing rewrites the URL in the database — nothing is deleted.
                  </span>
                  <button type="button" className="cms-btn" disabled={isFixing} style={repairBtnStyle('#a855f7')} onClick={() => runReconcile(false)}>
                    <i className={`fa-solid ${isFixing ? 'fa-spinner fa-spin' : 'fa-wrench'}`}></i>
                    Apply {localResult.repairable} repairs
                  </button>
                </div>
                <div className="cms-audit-table-wrap">
                  <table className="cms-audit-table">
                    <thead><tr><th>Name</th><th>Section</th><th>Saved URL (dead)</th><th>Actual Public ID</th></tr></thead>
                    <tbody>
                      {localResult.stale.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{r.name}</td>
                          <td>{r.section || '—'}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all', maxWidth: 300, color: '#ef4444' }}>{r.url}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all', color: '#22c55e' }}>{r.cloudinaryId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
        )}
        {tab === 'folderMismatch' && (
          localResult.folderMismatch.length === 0
            ? <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                <i className="fa-solid fa-circle-check" style={{ color: '#22c55e', marginRight: '0.5rem' }}></i>
                No state mismatches. Every file is tagged with the state the CMS implies.
              </p>
            : <div>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    These files exist in Cloudinary but carry a lifecycle tag that contradicts the CMS. Repairing rewrites the tag — the delivery URL never changes.
                  </span>
                  <button type="button" className="cms-btn" disabled={isFixing} style={repairBtnStyle('#3b82f6')} onClick={() => runReconcile(false)}>
                    <i className={`fa-solid ${isFixing ? 'fa-spinner fa-spin' : 'fa-wrench'}`}></i>
                    Apply {localResult.repairable} repairs
                  </button>
                </div>
                <div className="cms-audit-table-wrap">
                  <table className="cms-audit-table">
                    <thead><tr><th>Name</th><th>Expected State</th><th>Tagged As (Cloudinary)</th><th>CMS Section</th></tr></thead>
                    <tbody>
                      {localResult.folderMismatch.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{r.name}</td>
                          <td style={{ color: '#3b82f6', fontFamily: 'monospace' }}>{r.expectedFolder}</td>
                          <td style={{ color: '#ef4444', fontFamily: 'monospace' }}>{r.actualFolder}</td>
                          <td>{r.section}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
        )}
        {tab === 'orphaned' && (
          localResult.orphaned.length === 0
            ? <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                <i className="fa-solid fa-circle-check" style={{ color: '#22c55e', marginRight: '0.5rem' }}></i>
                No orphaned files. Everything in Cloudinary is tracked by the CMS.
              </p>
            : <div>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Files that exist on Cloudinary but are not registered in the CMS. You can import them back as Unused.
                  </span>
                  <button
                    type="button"
                    className="cms-btn"
                    style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    onClick={() => {
                      localResult.orphaned.forEach(o => {
                        const isVid = o.resourceType === 'video'
                        state.unused.push({
                          src: o.url,
                          name: o.url.split('/').pop() || 'media',
                          size: o.bytes,
                          ts: Date.now(),
                          type: isVid ? 'video/webm' : 'image/webp',
                          label: 'Recovered Orphan',
                          section: 'Recovery',
                          reason: 'upload'
                        })
                      })
                      persistUnused()
                      setLocalResult(prev => ({ ...prev, orphaned: [] }))
                      toast(`${localResult.orphaned.length} items recovered to Unused`, 'success')
                    }}
                  >
                    <i className="fa-solid fa-life-ring"></i>
                    Recover {localResult.orphaned.length} to Unused
                  </button>
                </div>
                <div className="cms-audit-table-wrap">
                  <table className="cms-audit-table">
                    <thead><tr><th>Public ID</th><th>Type</th><th>Format</th><th>Size</th><th>Folder</th><th>Action</th></tr></thead>
                  <tbody>
                    {localResult.orphaned.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all' }}>{r.publicId}</td>
                        <td>{r.resourceType}</td>
                        <td>{r.format}</td>
                        <td>{fmtBytes(r.bytes)}</td>
                        <td>{r.folder}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => handleDeleteOrphan(r.url, r.publicId)}
                            disabled={isDeleting === r.publicId}
                            style={{
                              padding: '0.3rem 0.6rem',
                              background: isDeleting === r.publicId ? '#fca5a5' : '#ef4444',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: isDeleting === r.publicId ? 'not-allowed' : 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              transition: 'background 0.2s'
                            }}
                          >
                            {isDeleting === r.publicId ? <><i className="fa-solid fa-spinner fa-spin mr-1"></i> Deleting...</> : <><i className="fa-solid fa-trash mr-1"></i> Delete</>}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
        )}
        {tab === 'broken' && (
          localResult.broken.length === 0
            ? <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                <i className="fa-solid fa-circle-check" style={{ color: '#22c55e', marginRight: '0.5rem' }}></i>
                No broken references. All CMS content exists in Cloudinary.
              </p>
            : <div>
              <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  These containers point at files that no longer exist. Purging empties them so the database matches what visitors already see. The containers stay in place and can be refilled.
                </span>
                <button
                  type="button"
                  className="cms-btn"
                  disabled={isFixing || localResult.purgeable === 0}
                  style={repairBtnStyle('#ef4444')}
                  onClick={() => {
                    if (!confirm(`Empty ${localResult.purgeable} containers whose file is gone? This rewrites the database and cannot be undone.`)) return
                    runReconcile(true)
                  }}
                >
                  <i className={`fa-solid ${isFixing ? 'fa-spinner fa-spin' : 'fa-broom'}`}></i>
                  Purge {localResult.purgeable} dead references
                </button>
              </div>
              <div className="cms-audit-table-wrap">
                <table className="cms-audit-table">
                  <thead><tr><th>Name</th><th>State</th><th>Section</th><th>URL</th></tr></thead>
                  <tbody>
                    {localResult.broken.map((r, i) => (
                      <tr key={i}>
                        <td>{r.name}</td>
                        <td>
                          <span className={`cms-tag cms-tag--${r.state === 'used' ? 'uso' : r.state === 'unused' ? 'nouso' : 'basurero'}`}>
                            {r.state === 'used' ? 'In Use' : r.state === 'unused' ? 'Unused' : 'Trash'}
                          </span>
                        </td>
                        <td>{r.section || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all', maxWidth: 300 }}>{r.url}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
        )}
        {tab === 'matching' && (
          localResult.matching.length === 0
            ? <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                No synced files found.
              </p>
            : <div className="cms-audit-table-wrap">
                <table className="cms-audit-table">
                  <thead><tr><th>Name</th><th>State</th><th>Cloudinary ID</th><th>URL</th></tr></thead>
                  <tbody>
                    {localResult.matching.map((r, i) => (
                      <tr key={i}>
                        <td>{r.name}</td>
                        <td>
                          <span className={`cms-tag cms-tag--${r.state === 'used' ? 'uso' : r.state === 'unused' ? 'nouso' : 'basurero'}`}>
                            {r.state === 'used' ? 'In Use' : r.state === 'unused' ? 'Unused' : 'Trash'}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all' }}>{r.cloudinaryId}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all', maxWidth: 300 }}>{r.url}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        )}
      </div>
    </CmsModal>
  )
}
