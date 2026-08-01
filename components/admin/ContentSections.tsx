'use client'

/* Secciones de Contenidos del panel — port de admin.js: En uso /
   Sin usar / Repositorio / Basurero, con selección múltiple, lotes,
   vista previa y menús contextuales por estado. */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { fmtBytes } from '@/lib/utils'
import {
  state, sumSizes, deduplicateMedia, moveUsedToUnused, moveUnusedToTrash, restoreTrashToUnused,
  performRestore, loadJSON, saveJSON, LS, type UsedEntry,
} from '@/lib/cms/store'
import { buildPageTree } from '@/lib/cms/pages'
import { listCloudinaryResources, type CloudinaryResourceInfo } from '@/lib/api'
import {
  deletePermanent, emptyTrash, purgeUnused, autoCleanTrash,
  batchMoveUsedToUnused, batchMoveUnusedToTrash, batchDeletePermanent,
} from './actions'
import { MediaCard, type AnyEntry, type MenuAction } from './cards'
import { SyncAuditModal, type SyncAuditResult } from './modals'

export type AdminModal =
  | { kind: 'view'; e: AnyEntry; cardType: 'used' | 'unused' | 'trash' | 'repo'; menu: { label: React.ReactNode; onClick: () => void }[] }
  | { kind: 'rename'; key: string }
  | { kind: 'associate'; item: AnyEntry; isUnused: boolean; idx: number }
  | { kind: 'editInfo'; key: string }
  | { kind: 'selectContainerAction'; action: 'editInfo' | 'rename' | 'remove'; occs: UsedEntry[] }

type Sel = { type: string; val: string }

type Ctx = {
  usedArr: AnyEntry[]
  unusedArr: AnyEntry[]
  trashArr: AnyEntry[]
  openModal: (m: AdminModal) => void
}

function useSelection() {
  const [multiSelect, setMultiSelect] = useState(false)
  const [selected, setSelected] = useState<Sel[]>([])
  const isSel = (type: string, val: string) => selected.some((x) => x.type === type && x.val === val)
  const toggle = (type: string, val: string, on: boolean) =>
    setSelected((s) => (on ? [...s, { type, val }] : s.filter((x) => !(x.type === type && x.val === val))))
  const toggleMulti = () => { setMultiSelect((m) => !m); setSelected([]) }
  return { multiSelect, selected, setSelected, isSel, toggle, toggleMulti }
}

function MultiToggleBtn({ multiSelect, onClick }: { multiSelect: boolean; onClick: () => void }) {
  return (
    <button type="button" className="cms-btn cms-btn--sm" onClick={onClick}>
      <i className="fa-solid fa-check-square"></i> {multiSelect ? 'Disable selection' : 'Multi-select'}
    </button>
  )
}

// Menú de opciones extra de la sección (selección múltiple, vaciar, filtros,
// política de borrado, etc.) oculto detrás de un ícono de hamburguesa —
// mismo patrón en las 4 subsecciones de Contenidos, para no saturar el header.
// Los hijos reciben `close` para cerrar el panel tras una acción.
function SectionOptionsMenu({ children }: { children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    const onClick = (ev: MouseEvent) => {
      if (!ref.current?.contains(ev.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [open])

  return (
    <div className="admin-options-menu" ref={ref}>
      <button
        type="button" className="cms-iconbtn" aria-label="More options" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <i className="fa-solid fa-bars"></i>
      </button>
      {open && <div className="admin-options-panel">{children(close)}</div>}
    </div>
  )
}

function BatchBar({ count, actionLabel, danger, actionDisabled, onCancel, onAction }: {
  count: number; actionLabel: string; danger?: boolean; actionDisabled?: boolean; onCancel: () => void; onAction: () => void
}) {
  return (
    <div className="cms-batch-bar">
      <div className="cms-batch-info">
        <span className="cms-batch-count">{count}</span>
        <span className="cms-batch-text">
          {count === 0 ? 'Select items' : count === 1 ? 'item selected' : 'items selected'}
        </span>
      </div>
      <div className="cms-batch-actions">
        <button type="button" className="cms-btn cms-btn--ghost cms-btn--sm" onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className={`cms-btn cms-btn--sm cms-btn--primary${danger ? ' cms-batch-danger' : ''}`}
          disabled={count === 0 || actionDisabled}
          onClick={onAction}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

// Menús contextuales por estado (compartidos por tarjeta y vista previa)
function useMenus({ openModal }: Pick<Ctx, 'openModal'>) {
  const { confirm } = useModal()

  const usedMenu = (e: AnyEntry): MenuAction[] => {
    const occs = e.src ? Object.values(state.usedContent).filter(u => u.src === e.src) : [e as UsedEntry]
    if (occs.length > 1) {
      const editOccs = occs.filter(u => u.fields && u.fields.length > 0)
      const acts: MenuAction[] = []
      if (editOccs.length > 0) {
        acts.push({ icon: 'fa-pen', color: '#22c55e', label: `Edit info (${editOccs.length} containers)...`, onClick: () => openModal({ kind: 'selectContainerAction', action: 'editInfo', occs: editOccs }) })
      }
      acts.push(
        { icon: 'fa-box-archive', color: '#eab308', label: `Move / Remove (${occs.length} uses)...`, onClick: () => openModal({ kind: 'selectContainerAction', action: 'remove', occs }) },
        { icon: 'fa-link', color: '#a855f7', label: 'Associate with another container', onClick: () => openModal({ kind: 'associate', item: e, isUnused: false, idx: -1 }) },
        { icon: 'fa-signature', color: '#3b82f6', label: `Rename container (${occs.length} containers)...`, onClick: () => openModal({ kind: 'selectContainerAction', action: 'rename', occs }) }
      )
      return acts
    }

    const singleActs: MenuAction[] = []
    const ue = e as UsedEntry
    if (ue.fields && ue.fields.length > 0) {
      singleActs.push({ icon: 'fa-pen', color: '#22c55e', label: 'Edit info', onClick: () => openModal({ kind: 'editInfo', key: ue.key }) })
    }
    singleActs.push(
      { icon: 'fa-box-archive', color: '#eab308', label: 'Move to Unused', onClick: () => {
        const k = (e as { key: string }).key
        const otherUses = e.src ? Object.values(state.usedContent).filter(u => u.src === e.src && u.key !== k) : []
        if (otherUses.length > 0) {
          const otherNames = otherUses.map(u => u.label || u.key).join(', ')
          confirm('Empty Container',
            <>Content is in use in: <strong>{otherNames}</strong>.<br /><br />
              Container <strong>{e.label || k}</strong> will be emptied, but the file <strong>will not be moved to unused</strong> because it is still active in other containers.</>,
            () => moveUsedToUnused(k))
        } else {
          confirm('Move to Unused',
            <>Move <strong>{e.label || k}</strong> to Unused? It will be removed from the site.</>,
            () => moveUsedToUnused(k))
        }
      } },
      { icon: 'fa-link', color: '#a855f7', label: 'Associate with another container', onClick: () => openModal({ kind: 'associate', item: e, isUnused: false, idx: -1 }) },
      { icon: 'fa-signature', color: '#3b82f6', label: 'Rename container', onClick: () => openModal({ kind: 'rename', key: (e as { key: string }).key }) }
    )
    return singleActs
  }

  const unusedMenu = (e: AnyEntry): MenuAction[] => {
    const idx = e._idx ?? -1
    const acts: MenuAction[] = [
      { icon: 'fa-link', color: '#a855f7', label: 'Associate with container', onClick: () => openModal({ kind: 'associate', item: e, isUnused: true, idx }) },
    ]
    if (e.key) {
      acts.push({ icon: 'fa-rotate-left', color: '#22c55e', label: 'Restore', onClick: () => {
        const occupied = state.usedContent[e.key!]
        confirm('Restore content',
          <>You are about to restore <strong>{e.label || 'content'}</strong>{e.section ? <> in section <strong>{e.section}</strong></> : null}.
            {occupied ? (
              <div className="cms-confirm-warn"><i className="fa-solid fa-triangle-exclamation"></i> Current content in that location (<strong>{occupied.name || occupied.label}</strong>) will be moved to <strong>unused</strong>.</div>
            ) : (
              <div className="cms-confirm-warn"><i className="fa-solid fa-circle-info"></i> It will be displayed on the site again.</div>
            )}</>,
          () => performRestore(idx))
      } })
    }
    acts.push({ icon: 'fa-trash', color: 'danger', label: 'Move to trash', onClick: () => moveUnusedToTrash(idx) })
    return acts
  }

  const trashMenu = (e: AnyEntry): MenuAction[] => [
    { icon: 'fa-folder-closed', color: '#eab308', label: 'Move to unused', onClick: () => restoreTrashToUnused(e._idx ?? -1) },
    { icon: 'fa-skull', color: 'danger', label: 'Delete permanently', onClick: () => {
      confirm('Delete permanently', 'Permanently delete from Cloudinary? This action cannot be undone.', () => { deletePermanent(e._idx ?? -1) })
    } },
  ]

  return { usedMenu, unusedMenu, trashMenu }
}

const toViewMenu = (acts: MenuAction[]) =>
  acts.map((a) => ({
    label: <><i className={`fa-solid ${a.icon}`} style={{ color: a.color === 'danger' ? '#ef4444' : a.color, marginRight: 6 }}></i> {a.label}</>,
    onClick: a.onClick,
  }))

const USED_INFO = 'All content in use, organized by page and section. Pages or sections without content are still shown with zero count.'

const toggleInSet = (upd: (updater: (prev: Set<string>) => Set<string>) => void, id: string) =>
  upd((prev) => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

// Título + ícono de ayuda con tooltip — mismo patrón en las 4 subsecciones de Contenidos
function SectionHeading({ icon, title, info }: { icon: string; title: string; info: string }) {
  return (
    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <i className={`fa-solid ${icon}`}></i> {title}
      <span className="cms-info-tip" tabIndex={0} aria-label={info}>
        <i className="fa-solid fa-circle-info"></i>
        <span className="cms-info-bubble" role="tooltip">{info}</span>
      </span>
    </h2>
  )
}

// Cantidad de archivos + tamaño total, destacados — mismo patrón en las 4 subsecciones
function ContentStats({ count, size }: { count: number; size: number }) {
  return (
    <div className="admin-content-stats">
      <span>Files: <span className="admin-badge">{count}</span></span>
      <span>Total size: <span className="admin-badge">{fmtBytes(size)}</span></span>
    </div>
  )
}

export function SectionUsado({ usedArr, openModal }: Ctx) {
  const sel = useSelection()
  const { confirm } = useModal()
  const { usedMenu } = useMenus({ openModal })
  const deduplicatedArr = useMemo(() => {
    const map = new Map<string, AnyEntry>()
    for (const e of usedArr) {
      const src = e.src || e.dataUrl || (e as { key?: string }).key || ''
      const section = (e as any).section || 'unknown'
      const dupKey = `${src}::${section}`
      if (!map.has(dupKey)) {
        map.set(dupKey, e)
      }
    }
    return Array.from(map.values())
  }, [usedArr])
  const count = sel.selected.length
  const [openPages, setOpenPages] = useState<Set<string>>(() => new Set())
  const [openSecs, setOpenSecs] = useState<Set<string>>(() => new Set())
  const tree = buildPageTree(deduplicatedArr)

  const getItemSelKey = (it: AnyEntry) => it.src || (it as { key?: string }).key || ''

  const renderCard = (e: AnyEntry) => {
    const selKey = getItemSelKey(e)
    return (
      <MediaCard
        key={selKey} e={e} cardType="used" actions={usedMenu(e)}
        multiSelect={sel.multiSelect}
        selected={sel.isSel('used', selKey)}
        onToggleSelect={(on) => sel.toggle('used', selKey, on)}
        onView={() => openModal({ kind: 'view', e, cardType: 'used', menu: toViewMenu(usedMenu(e)) })}
      />
    )
  }

  return (
    <div className={`admin-card${sel.multiSelect ? ' cms-multi-mode' : ''}`}>
      <div className="admin-card-head">
        <SectionHeading icon="fa-check" title="Content in Use" info={USED_INFO} />
        <SectionOptionsMenu>
          {(close) => (
            <MultiToggleBtn multiSelect={sel.multiSelect} onClick={() => { sel.toggleMulti(); close() }} />
          )}
        </SectionOptionsMenu>
      </div>
      <ContentStats count={deduplicatedArr.length} size={sumSizes(deduplicatedArr)} />
      {sel.multiSelect && (
        <BatchBar
          count={count} actionLabel="Move to Unused"
          onCancel={sel.toggleMulti}
          onAction={() => {
            if (!count) return
            confirm('Move multiple to unused', `Move ${count} unique items (and all their container occurrences) to unused?`, () => {
              const keysToRemove: string[] = []
              sel.selected.forEach((x) => {
                Object.values(state.usedContent).forEach((u) => {
                  if (u.src === x.val || u.key === x.val) {
                    keysToRemove.push(u.key)
                  }
                })
              })
              batchMoveUsedToUnused(keysToRemove)
              sel.toggleMulti()
            })
          }}
        />
      )}
      <div className="admin-tree">
        {tree.map((page) => {
          const pOpen = openPages.has(page.id)
          const pageKeys = page.sections.flatMap((s) => s.items.map(getItemSelKey))
          const pageAllSelected = pageKeys.length > 0 && pageKeys.every((k) => sel.isSel('used', k))
          const closePage = () => {
            toggleInSet(setOpenPages, page.id)
            if (pOpen) {
              // al colapsar la página, sus secciones vuelven a quedar cerradas
              setOpenSecs((prev) => {
                const n = new Set(prev)
                page.sections.forEach((s) => n.delete(`${page.id}:${s.id}`))
                return n
              })
            }
          }
          return (
            <div className="admin-tree-page" key={page.id}>
              <div className={`admin-tree-row admin-tree-row--page${pOpen ? ' open' : ''}`}>
                <button
                  type="button"
                  className="admin-tree-rowbtn"
                  onClick={closePage}
                  aria-expanded={pOpen}
                >
                  <i className="fa-solid fa-chevron-right admin-tree-caret"></i>
                  <i className={`fa-solid ${page.icon} admin-tree-icon`}></i>
                  <span className="admin-tree-label">{page.label}</span>
                  {page.count > 0 && (
                    <span className="admin-badge">{page.count} files · {fmtBytes(page.size)}</span>
                  )}
                </button>
                {sel.multiSelect && page.count > 0 && (
                  <input
                    type="checkbox" title="Select entire page"
                    className="cms-check cms-check--all"
                    checked={pageAllSelected}
                    onChange={(ev) => pageKeys.forEach((k) => sel.toggle('used', k, ev.target.checked))}
                  />
                )}
              </div>
              {pOpen && (
                <div className="admin-tree-sections">
                  {page.sections.length === 0 && (
                    <p className="cms-admin-sub admin-tree-empty">This page has no sections yet.</p>
                  )}
                  {page.sections.map((s) => {
                    const sid = `${page.id}:${s.id}`
                    const sOpen = openSecs.has(sid)
                    const secKeys = s.items.map(getItemSelKey)
                    const secAllSelected = secKeys.length > 0 && secKeys.every((k) => sel.isSel('used', k))
                    return (
                      <div className="admin-tree-section" key={sid}>
                        <div className={`admin-tree-row admin-tree-row--section${sOpen ? ' open' : ''}`}>
                          <button
                            type="button" className="admin-tree-rowbtn"
                            onClick={() => toggleInSet(setOpenSecs, sid)}
                            aria-expanded={sOpen}
                          >
                            <i className="fa-solid fa-chevron-right admin-tree-caret"></i>
                            <span className="admin-tree-label">{s.label}</span>
                            {s.count > 0 && (
                              <span className="admin-badge">{s.count} files · {fmtBytes(s.size)}</span>
                            )}
                          </button>
                          {sel.multiSelect && s.count > 0 && (
                            <input
                              type="checkbox" title="Select entire section" className="cms-check cms-check--all"
                              checked={secAllSelected}
                              onChange={(ev) => secKeys.forEach((k) => sel.toggle('used', k, ev.target.checked))}
                            />
                          )}
                        </div>
                        {sOpen && (

                          <div className="admin-tree-content">
                            {s.count === 0
                              ? <p className="cms-admin-sub admin-tree-empty">No content in this section.</p>
                              : <div className="cms-mlib-grid">{s.items.map(renderCard)}</div>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const UNUSED_INFO = 'Replaced or retired versions from the site. Restore them to their original location or send them to trash.'
const TRASH_INFO = 'Content marked for deletion. It is automatically deleted based on the chosen policy, or you can empty it manually.'
const REPO_INFO = 'Unified view of all managed content in any state.'

const getUnusedTag = (e: AnyEntry) => {
  if (e.reason === 'upload') return <span className="cms-tag cms-tag--subido">Just uploaded</span>
  if (e.reason === 'replaced') return <span className="cms-tag cms-tag--reemplazado">Replaced</span>
  if (e.reason === 'deleted') return <span className="cms-tag cms-tag--basurero">Deleted</span>
  if (e.reason === 'retired') return <span className="cms-tag cms-tag--retirado">Retired</span>
  return null
}

export function SectionNoUsado({ unusedArr, openModal }: Ctx) {
  const sel = useSelection()
  const { confirm } = useModal()
  const { unusedMenu } = useMenus({ openModal })
  const count = sel.selected.length

  return (
    <div className={`admin-card${sel.multiSelect ? ' cms-multi-mode' : ''}`}>
      <div className="admin-card-head">
        <SectionHeading icon="fa-folder-closed" title="Unused Content" info={UNUSED_INFO} />
        <SectionOptionsMenu>
          {(close) => (
            <>
              <MultiToggleBtn multiSelect={sel.multiSelect} onClick={() => { sel.toggleMulti(); close() }} />
              {unusedArr.length > 0 && (
                <button type="button" className="cms-btn cms-btn--sm cms-btn--primary"
                  onClick={() => { close(); confirm('Empty unused', 'Everything will be moved to trash.', purgeUnused) }}>
                  <i className="fa-solid fa-trash-can"></i> Empty all unused
                </button>
              )}
            </>
          )}
        </SectionOptionsMenu>
      </div>
      <ContentStats count={unusedArr.length} size={sumSizes(unusedArr)} />
      {sel.multiSelect && (
        <BatchBar
          count={count} actionLabel="Move to Trash" danger
          onCancel={sel.toggleMulti}
          onAction={() => {
            if (!count) return
            confirm('Move multiple to trash', `Move ${count} items to trash?`, () => {
              batchMoveUnusedToTrash(sel.selected.map((x) => parseInt(x.val, 10)))
              sel.toggleMulti()
            })
          }}
        />
      )}
      <div className="cms-mlib-grid">
        {unusedArr.map((e) => (
          <MediaCard
            key={e._idx} e={e} cardType="unused" actions={unusedMenu(e)} tags={getUnusedTag(e)}

            multiSelect={sel.multiSelect}
            selected={sel.isSel('unused', String(e._idx))}
            onToggleSelect={(on) => sel.toggle('unused', String(e._idx), on)}
            onView={() => openModal({ kind: 'view', e, cardType: 'unused', menu: toViewMenu(unusedMenu(e)) })}
          />
        ))}
      </div>
    </div>
  )
}

export function SectionBasurero({ trashArr, openModal }: Ctx) {
  const sel = useSelection()
  const { confirm } = useModal()
  const toast = useToast()
  const { trashMenu } = useMenus({ openModal })
  const [policy, setPolicy] = useState(() => loadJSON<string>(LS.TRASH_POLICY, 'manual'))
  const count = sel.selected.length

  return (
    <div className={`admin-card${sel.multiSelect ? ' cms-multi-mode' : ''}`}>
      <div className="admin-card-head" style={{ alignItems: 'center' }}>
        <SectionHeading icon="fa-trash-can" title="Trash" info={TRASH_INFO} />
        <SectionOptionsMenu>
          {(close) => (
            <>
              <MultiToggleBtn multiSelect={sel.multiSelect} onClick={() => { sel.toggleMulti(); close() }} />
              {trashArr.length > 0 && (
                <button type="button" className="cms-btn cms-btn--sm cms-btn--primary"
                  onClick={() => { close(); confirm('Empty trash', 'Empty ALL trash and permanently delete from Cloudinary?', () => { emptyTrash() }) }}>
                  <i className="fa-solid fa-trash-can"></i> Empty all
                </button>
              )}
              <label className="admin-select-group">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <i className="fa-solid fa-clock-rotate-left"></i>
                  Auto delete
                </span>
                <select
                  className="admin-select"
                  value={policy}
                  onChange={(e) => { setPolicy(e.target.value); saveJSON(LS.TRASH_POLICY, e.target.value); autoCleanTrash() }}
                >
                  <option value="manual">Manual</option>
                  <option value="1d">1 day</option>
                  <option value="3d">3 days</option>
                  <option value="7d">1 week</option>
                </select>
              </label>
            </>
          )}
        </SectionOptionsMenu>
      </div>
      <ContentStats count={trashArr.length} size={sumSizes(trashArr)} />
      {sel.multiSelect && (
        <BatchBar
          count={count} actionLabel="Delete Permanently" danger
          onCancel={sel.toggleMulti}
          onAction={() => {
            if (!count) return
            confirm('Delete permanently', `Permanently delete ${count} items? This cannot be undone.`, () => {
              toast('Deleting files from Cloudinary...', 'info')
              batchDeletePermanent(sel.selected.map((x) => parseInt(x.val, 10)))
              sel.toggleMulti()
            })
          }}
        />
      )}
      <div className="cms-mlib-grid">
        {trashArr.map((e) => (
          <MediaCard
            key={e._idx} e={e} cardType="trash" actions={trashMenu(e)}

            multiSelect={sel.multiSelect}
            selected={sel.isSel('trash', String(e._idx))}
            onToggleSelect={(on) => sel.toggle('trash', String(e._idx), on)}
            onView={() => openModal({ kind: 'view', e, cardType: 'trash', menu: toViewMenu(trashMenu(e)) })}
          />
        ))}
      </div>
    </div>
  )
}

// identificador de selección de un item del repo según su estado
const repoSelVal = (e: AnyEntry) => (e._state === 'used' ? (e.key || '') : String(e._idx))

// ----- Utilidades de Export CSV -----------------------------------------------

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

/** Recopila todas las URLs de Cloudinary conocidas del CMS. */
function collectCmsCloudinaryUrls(): { url: string; name: string; state: string; section: string }[] {
  const entries: { url: string; name: string; state: string; section: string }[] = []
  const seen = new Set<string>()
  Object.values(state.usedContent).forEach((e) => {
    if (e?.src?.includes('cloudinary.com') && !seen.has(e.src)) {
      seen.add(e.src)
      entries.push({ url: e.src, name: e.name || e.label || e.key, state: 'used', section: e.section || '' })
    }
  })
  state.unused.forEach((e) => {
    const src = e.src || e.dataUrl || ''
    if (src.includes('cloudinary.com') && !seen.has(src)) {
      seen.add(src)
      entries.push({ url: src, name: e.name || e.label || '', state: 'unused', section: e.section || '' })
    }
  })
  state.trash.forEach((e) => {
    const src = e.src || e.dataUrl || ''
    if (src.includes('cloudinary.com') && !seen.has(src)) {
      seen.add(src)
      entries.push({ url: src, name: e.name || e.label || '', state: 'trash', section: e.section || '' })
    }
  })
  return entries
}

/** Compara la lista de Cloudinary con la del CMS y genera el resultado de auditoría. */
function buildSyncAuditResult(
  cloudinaryList: CloudinaryResourceInfo[],
  cmsList: { url: string; name: string; state: string; section: string }[],
): SyncAuditResult {
  // Crear un Set de secure_urls de Cloudinary para comparación rápida
  const cloudinaryUrlSet = new Set(cloudinaryList.map((r) => r.secure_url))
  // Crear un Set de URLs del CMS
  const cmsUrlSet = new Set(cmsList.map((r) => r.url))

  // Matching: están en ambos
  const matching: SyncAuditResult['matching'] = []
  cmsList.forEach((cms) => {
    if (cloudinaryUrlSet.has(cms.url)) {
      const cloudRes = cloudinaryList.find((c) => c.secure_url === cms.url)
      matching.push({
        url: cms.url,
        name: cms.name,
        state: cms.state,
        cloudinaryId: cloudRes?.public_id || '',
      })
    }
  })

  // Orphaned: en Cloudinary pero NO en el CMS
  const orphaned: SyncAuditResult['orphaned'] = []
  cloudinaryList.forEach((cr) => {
    if (!cmsUrlSet.has(cr.secure_url)) {
      orphaned.push({
        url: cr.secure_url,
        publicId: cr.public_id,
        resourceType: cr.resource_type,
        format: cr.format,
        bytes: cr.bytes,
        folder: cr.folder,
      })
    }
  })

  // Broken: en CMS pero NO en Cloudinary
  const broken: SyncAuditResult['broken'] = []
  cmsList.forEach((cms) => {
    if (!cloudinaryUrlSet.has(cms.url)) {
      broken.push({ url: cms.url, name: cms.name, state: cms.state, section: cms.section })
    }
  })

  return { matching, orphaned, broken }
}

export function SectionRepo({ usedArr, unusedArr, trashArr, openModal }: Ctx) {
  const sel = useSelection()
  const { confirm } = useModal()
  const toast = useToast()
  const { usedMenu, unusedMenu, trashMenu } = useMenus({ openModal })
  const [filter, setFilter] = useState(() => loadJSON<string>(LS.REPO_FILTER, 'all'))
  const [syncAudit, setSyncAudit] = useState<SyncAuditResult | null>(null)
  const [syncing, setSyncing] = useState(false)

  const all: AnyEntry[] = deduplicateMedia([
    ...usedArr.map((x) => ({ ...x, _state: 'used' as const })),
    ...unusedArr.map((x) => ({ ...x, _state: 'unused' as const })),
    ...trashArr.map((x) => ({ ...x, _state: 'trash' as const })),
  ])
  const filtered = filter === 'all' ? all : all.filter((x) => x._state === filter)

  const stateTag = (s?: string) =>
    s === 'used' ? <span className="cms-tag cms-tag--uso">In Use</span>
      : s === 'unused' ? <span className="cms-tag cms-tag--nouso">Unused</span>
        : <span className="cms-tag cms-tag--basurero">Trash</span>

  // cada item conserva las opciones de SU apartado (uso / sin usar / basurero)
  const menuFor = (e: AnyEntry) =>
    e._state === 'used' ? usedMenu(e) : e._state === 'unused' ? unusedMenu(e) : trashMenu(e)

  // Lote: la acción depende del estado de lo seleccionado. Si hay estados
  // mezclados no hay una acción única → se deshabilita.
  const byState = (st: string) => sel.selected.filter((x) => x.type === st).map((x) => x.val)
  const usedSel = byState('used'); const unusedSel = byState('unused'); const trashSel = byState('trash')
  const activeStates = [usedSel.length && 'used', unusedSel.length && 'unused', trashSel.length && 'trash'].filter(Boolean) as string[]
  const single = activeStates.length === 1 ? activeStates[0] : null
  const batchLabel = activeStates.length > 1 ? 'Mixed selection'
    : single === 'used' ? 'Move to Unused'
      : single === 'unused' ? 'Move to Trash'
        : single === 'trash' ? 'Delete Permanently'
          : 'No action'
  const runBatch = () => {
    if (single === 'used') {
      confirm('Move multiple to unused', `Move ${usedSel.length} items to unused?`, () => {
        batchMoveUsedToUnused(usedSel); sel.toggleMulti()
      })
    } else if (single === 'unused') {
      confirm('Move multiple to trash', `Move ${unusedSel.length} items to trash?`, () => {
        batchMoveUnusedToTrash(unusedSel.map((v) => parseInt(v, 10))); sel.toggleMulti()
      })
    } else if (single === 'trash') {
      confirm('Delete permanently', `Permanently delete ${trashSel.length} items? This cannot be undone.`, () => {
        toast('Deleting files from Cloudinary...', 'info')
        batchDeletePermanent(trashSel.map((v) => parseInt(v, 10))); sel.toggleMulti()
      })
    }
  }

  // ----- Export handlers -----

  const exportCloudinary = async (close: () => void) => {
    close()
    toast('Fetching Cloudinary resources...', 'info')
    const resources = await listCloudinaryResources()
    if (resources.length === 0) {
      toast('No resources found in Cloudinary (or Cloudinary not configured).', 'error')
      return
    }
    downloadCsv(
      `cloudinary-export-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Public ID', 'URL', 'Type', 'Format', 'Size (bytes)', 'Folder', 'Created At'],
      resources.map((r) => [r.public_id, r.secure_url, r.resource_type, r.format, String(r.bytes), r.folder, r.created_at]),
    )
    toast(`Exported ${resources.length} Cloudinary resources to CSV`, 'success')
  }

  const exportCms = (close: () => void) => {
    close()
    const cmsList = collectCmsCloudinaryUrls()
    if (cmsList.length === 0) {
      toast('No Cloudinary content found in the CMS.', 'error')
      return
    }
    downloadCsv(
      `cms-export-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Name', 'URL', 'State', 'Section'],
      cmsList.map((r) => [r.name, r.url, r.state, r.section]),
    )
    toast(`Exported ${cmsList.length} CMS items to CSV`, 'success')
  }

  const compareSync = async (close: () => void) => {
    close()
    setSyncing(true)
    toast('Comparing Cloudinary vs Management... This may take a few seconds.', 'info')
    try {
      const [cloudinaryList, cmsList] = await Promise.all([
        listCloudinaryResources(),
        Promise.resolve(collectCmsCloudinaryUrls()),
      ])
      if (cloudinaryList.length === 0 && cmsList.length === 0) {
        toast('No content to compare.', 'error')
        setSyncing(false)
        return
      }
      const result = buildSyncAuditResult(cloudinaryList, cmsList)
      setSyncAudit(result)
      toast(`Audit complete: ${result.matching.length} synced, ${result.orphaned.length} orphaned, ${result.broken.length} broken refs`, result.orphaned.length + result.broken.length > 0 ? 'error' : 'success')
    } catch {
      toast('Error comparing Cloudinary vs CMS.', 'error')
    }
    setSyncing(false)
  }

  return (
    <>
    <div className={`admin-card${sel.multiSelect ? ' cms-multi-mode' : ''}`}>
      <div className="admin-card-head" style={{ alignItems: 'center' }}>
        <SectionHeading icon="fa-cloud" title="Total Repository" info={REPO_INFO} />
        <SectionOptionsMenu>
          {(close) => (
            <>
              <MultiToggleBtn multiSelect={sel.multiSelect} onClick={() => { sel.toggleMulti(); close() }} />
              <label className="admin-select-group">
                <i className="fa-solid fa-filter"></i>
                Filter by
                <select
                  className="admin-select"
                  value={filter}
                  onChange={(e) => { setFilter(e.target.value); saveJSON(LS.REPO_FILTER, e.target.value) }}
                >
                  <option value="all">All content</option>
                  <option value="used">Only in use</option>
                  <option value="unused">Only unused</option>
                  <option value="trash">Only trash</option>
                </select>
              </label>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.5rem 0' }} />
              <button type="button" className="cms-btn cms-btn--sm" onClick={() => exportCloudinary(close)} disabled={syncing}>
                <i className="fa-solid fa-cloud-arrow-down"></i> Export Cloudinary
              </button>
              <button type="button" className="cms-btn cms-btn--sm" onClick={() => exportCms(close)}>
                <i className="fa-solid fa-file-export"></i> Export Management
              </button>
              <button type="button" className="cms-btn cms-btn--sm cms-btn--primary" onClick={() => compareSync(close)} disabled={syncing}>
                <i className={`fa-solid ${syncing ? 'fa-spinner fa-spin' : 'fa-magnifying-glass-chart'}`}></i> {syncing ? 'Comparing...' : 'Compare Sync'}
              </button>
            </>
          )}
        </SectionOptionsMenu>
      </div>
      <ContentStats count={filtered.length} size={sumSizes(filtered)} />
      {sel.multiSelect && (
        <BatchBar
          count={sel.selected.length} actionLabel={batchLabel}
          danger={single === 'unused' || single === 'trash'}
          actionDisabled={!single}
          onCancel={sel.toggleMulti}
          onAction={runBatch}
        />
      )}
      <div className="cms-mlib-grid">
        {filtered.map((e, i) => {
          const st = e._state as string
          const val = repoSelVal(e)
          const actions = menuFor(e)
          return (
            <MediaCard
              key={i} e={e} cardType="repo" actions={actions}
              tags={stateTag(e._state)}
              multiSelect={sel.multiSelect}
              selected={sel.isSel(st, val)}
              onToggleSelect={(on) => sel.toggle(st, val, on)}
              onView={() => openModal({ kind: 'view', e, cardType: 'repo', menu: toViewMenu(actions) })}
            />
          )
        })}
      </div>
    </div>
    {syncAudit && <SyncAuditModal result={syncAudit} onClose={() => setSyncAudit(null)} />}
    </>
  )
}
